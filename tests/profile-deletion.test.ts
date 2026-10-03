import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import fs from "node:fs/promises";
import { initialiseDatabase, localBootstrap, DEMO_ADMIN } from "@/lib/local-db";
import { operationSchema } from "@/lib/validation";
import { profileBlockingVisits } from "@/lib/profile-deletion";
import type { Visit } from "@/lib/models";

let db: PGlite;
async function query<T = Record<string, unknown>>(
  role: string,
  id: string,
  sql: string,
  args: unknown[] = [],
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    return (await tx.query<T>(sql, args)).rows;
  });
}
const admin = <T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
) => query<T>("authenticated", DEMO_ADMIN, sql, args);
async function fixture() {
  const cleaner = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [cleaner]);
  await admin("select register_cleaner($1)", [
    JSON.stringify({
      id: cleaner,
      name: "Deletion Fixture Cleaner",
      availability: Array.from({ length: 7 }, (_, weekday) => ({
        weekday,
        start_time: "08:00",
        end_time: "20:00",
      })),
    }),
  ]);
  const customer = (
    await admin<{ id: string }>("select save_customer($1) as id", [
      JSON.stringify({
        name: "Deletion Fixture Customer",
        email: "delete@example.test",
        phone: "+447700901234",
        address: "3 Synthetic Lane",
        postcode: "ME14 1AA",
      }),
    ])
  )[0].id;
  return { customer, cleaner };
}
async function book(
  f: Awaited<ReturnType<typeof fixture>>,
  date = "2000-01-03",
  extra = {},
) {
  return (
    await admin<{ id: string }>("select create_booking($1) as id", [
      JSON.stringify({
        customer_id: f.customer,
        cleaner_id: f.cleaner,
        date,
        time: "09:00",
        duration_minutes: 120,
        interval_weeks: 0,
        occurrences: 1,
        customer_rate_pence: 1800,
        admin_rate_pence: 300,
        cleaner_rate_pence: 1500,
        ...extra,
      }),
    ])
  )[0].id;
}
async function history(f: Awaited<ReturnType<typeof fixture>>) {
  return {
    visits: await admin(
      "select * from visits where customer_id=$1 order by id",
      [f.customer],
    ),
    rates: await admin(
      "select f.* from visit_finances f join visits v on f.id=v.id where v.customer_id=$1 order by f.id",
      [f.customer],
    ),
    agreements: await admin(
      "select f.* from series_finances f join booking_series s on f.id=s.id where s.customer_id=$1 order by f.id",
      [f.customer],
    ),
    hours: await admin(
      "select * from availability where cleaner_id=$1 order by id",
      [f.cleaner],
    ),
  };
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await initialiseDatabase(db, true);
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("history-preserving customer and cleaner deletion", () => {
  it("validates deletion IDs and denies public/cleaner/direct deletion", async () => {
    const f = await fixture();
    for (const kind of ["customer", "cleaner"] as const) {
      const id = f[kind];
      expect(
        operationSchema.safeParse({
          action: `delete_${kind}`,
          data: { id: "invalid" },
        }).success,
      ).toBe(false);
      expect(
        operationSchema.safeParse({ action: `delete_${kind}`, data: { id } })
          .success,
      ).toBe(true);
      await expect(
        query("anon", "", `select delete_${kind}($1)`, [id]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        query("authenticated", f.cleaner, `select delete_${kind}($1)`, [id]),
      ).rejects.toThrow(/Admin access/);
      await expect(
        admin(
          `delete from ${kind === "customer" ? "customers" : "cleaners"} where id=$1`,
          [id],
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });
  it("blocks deletion until upcoming, ongoing and started work is resolved", async () => {
    const f = await fixture();
    const id = await book(f, "2200-07-01");
    for (const kind of ["customer", "cleaner"] as const)
      await expect(
        admin(`select delete_${kind}($1)`, [f[kind]]),
      ).rejects.toThrow(/upcoming visits/);
    await admin("select change_visit($1)", [
      JSON.stringify({ id, status: "cancelled" }),
    ]);
    const past = await book(f);
    await query(
      "authenticated",
      f.cleaner,
      "select transition_visit($1,'started')",
      [past],
    );
    for (const kind of ["customer", "cleaner"] as const)
      await expect(
        admin(`select delete_${kind}($1)`, [f[kind]]),
      ).rejects.toThrow(/in-progress visits/);
    await query(
      "authenticated",
      f.cleaner,
      "select transition_visit($1,'completed')",
      [past],
    );
    const before = await history(f);
    await admin("select delete_customer($1)", [f.customer]);
    await admin("select delete_cleaner($1)", [f.cleaner]);
    expect(await history(f)).toEqual(before);
  });
  it("retains exact work, rates, agreement, contacts and conversation history while closing customer follow-ups", async () => {
    const f = await fixture();
    const series = await book(f, "2000-01-03", {
      interval_weeks: 1,
      occurrences: 4,
      duration_weeks: 4,
    });
    await book(f, "2200-07-01");
    const future = (
      await admin<{ id: string }>(
        "select id from visits where customer_id=$1 order by starts_at desc limit 1",
        [f.customer],
      )
    )[0].id;
    await query(
      "authenticated",
      f.cleaner,
      "select transition_visit($1,'started')",
      [future],
    );
    await query(
      "authenticated",
      f.cleaner,
      "select transition_visit($1,'completed')",
      [future],
    );
    await admin("select save_task($1)", [
      JSON.stringify({
        customer_id: f.customer,
        title: "Preserved follow-up",
        due_on: "2000-01-01",
        done: false,
      }),
    ]);
    const conversation = randomUUID();
    await db.query(
      "insert into conversations(id,provider,root_call_id,caller,customer_id) values($1::uuid,'fixture',$1::text,'+447700901234',$2)",
      [conversation, f.customer],
    );
    const details = (
      await admin(
        "select to_jsonb(c)-'deleted_at' as row from customers c where id=$1",
        [f.customer],
      )
    )[0];
    const before = await history(f);
    const calls = await admin("select * from conversations where id=$1", [
      conversation,
    ]);
    await admin("select delete_customer($1)", [f.customer]);
    await admin("select sync_customer_pipeline()");
    expect(await history(f)).toEqual(before);
    expect(
      (
        await admin(
          "select to_jsonb(c)-'deleted_at' as row from customers c where id=$1",
          [f.customer],
        )
      )[0],
    ).toEqual(details);
    expect(
      await admin("select * from conversations where id=$1", [conversation]),
    ).toEqual(calls);
    expect(
      (
        await admin<{ stage: string; next_contact_on: null }>(
          "select stage,next_contact_on from acquisition_leads where customer_id=$1",
          [f.customer],
        )
      )[0],
    ).toEqual({ stage: "closed", next_contact_on: null });
    expect(
      (
        await admin<{ active: boolean; deleted_at: Date }>(
          "select active,deleted_at from booking_series where id=$1",
          [series],
        )
      )[0],
    ).toMatchObject({ active: false, deleted_at: expect.any(Date) });
    expect(
      (
        await admin<{ done: boolean }>(
          "select done from follow_up_tasks where customer_id=$1",
          [f.customer],
        )
      )[0].done,
    ).toBe(false);
    expect(
      await admin(
        "select note from acquisition_history h join acquisition_leads l on l.id=h.lead_id where l.customer_id=$1 and note like 'Customer deleted%'",
        [f.customer],
      ),
    ).toHaveLength(1);
  });
  it("prevents stale customer edits, new booking, reopening and linking after deletion", async () => {
    const f = await fixture();
    await admin("select delete_customer($1)", [f.customer]);
    await expect(book(f, "2200-07-01")).rejects.toThrow(
      /customer has been deleted/,
    );
    await expect(
      book(f, "2200-07-01", {
        interval_weeks: 1,
        occurrences: 4,
        duration_weeks: 4,
      }),
    ).rejects.toThrow(/customer has been deleted/);
    await expect(
      admin("select save_customer($1)", [
        JSON.stringify({
          id: f.customer,
          name: "Stale edit",
          address: "3 Synthetic Lane",
          postcode: "ME14 1AA",
        }),
      ]),
    ).rejects.toThrow(/history is read-only/);
    const lead = (
      await admin<{ id: string }>(
        "select id from acquisition_leads where customer_id=$1",
        [f.customer],
      )
    )[0].id;
    await expect(
      admin("select set_pipeline_stage($1)", [
        JSON.stringify({
          id: lead,
          stage: "opportunity",
          expected_stage: "closed",
        }),
      ]),
    ).rejects.toThrow(/pipeline history is closed/);
    await expect(
      admin("select save_opportunity($1)", [
        JSON.stringify({
          id: lead,
          name: "Stale opportunity",
          email: "stale@example.test",
        }),
      ]),
    ).rejects.toThrow(/history is read-only/);
    expect(
      await admin("select * from visits where customer_id=$1", [f.customer]),
    ).toHaveLength(0);
  });
  it("allows deletion after cover and retains assigned visits, their rates and original series agreement", async () => {
    const f = await fixture(),
      cover = await fixture();
    const series = await book(f, "2200-07-01", {
      interval_weeks: 1,
      occurrences: 2,
      duration_weeks: 2,
    });
    const jobs = await admin<{ id: string }>(
      "select id from visits where series_id=$1",
      [series],
    );
    for (const visit of jobs)
      await admin("select change_visit($1)", [
        JSON.stringify({ id: visit.id, cleaner_id: cover.cleaner }),
      ]);
    const before = await history(f);
    await admin("select delete_cleaner($1)", [f.cleaner]);
    expect(await history(f)).toEqual(before);
    expect(
      (
        await admin<{ active: boolean }>(
          "select active from booking_series where id=$1",
          [series],
        )
      )[0].active,
    ).toBe(true);
    expect(
      await query(
        "authenticated",
        cover.cleaner,
        "select * from cleaner_jobs()",
      ),
    ).toHaveLength(2);
    await expect(
      admin("select change_visit($1)", [
        JSON.stringify({ id: jobs[0].id, cleaner_id: f.cleaner }),
      ]),
    ).rejects.toThrow(/inactive or deleted/);
  });
  it("disables direct cleaner reads and operations while retaining history and resolving pending requests", async () => {
    const f = await fixture();
    await book(f);
    await query("authenticated", f.cleaner, "select request_leave($1)", [
      JSON.stringify({
        starts_on: "2200-08-01",
        ends_on: "2200-08-02",
        reason: "Fixture",
      }),
    ]);
    await query("authenticated", f.cleaner, "select request_availability($1)", [
      JSON.stringify({ weekday: 1, start_time: "09:00", end_time: "17:00" }),
    ]);
    const before = await history(f);
    await admin("select delete_cleaner($1)", [f.cleaner]);
    expect(await history(f)).toEqual(before);
    for (const table of [
      "profiles",
      "cleaners",
      "visits",
      "availability",
      "leave_requests",
      "availability_requests",
    ])
      expect(
        await query("authenticated", f.cleaner, `select * from ${table}`),
      ).toEqual([]);
    expect(
      await query("authenticated", f.cleaner, "select * from cleaner_jobs()"),
    ).toEqual([]);
    for (const fn of ["request_leave", "request_availability"])
      await expect(
        query("authenticated", f.cleaner, `select ${fn}($1)`, ["{}"]),
      ).rejects.toThrow(/Cleaner access/);
    await expect(
      query(
        "authenticated",
        f.cleaner,
        "select transition_visit($1,'started')",
        [(before.visits[0] as { id: string }).id],
      ),
    ).rejects.toThrow(/Cleaner access/);
    await expect(
      admin("select save_cleaner_availability($1)", [
        JSON.stringify({ cleaner_id: f.cleaner, availability: [] }),
      ]),
    ).rejects.toThrow(/history is read-only/);
    for (const table of ["leave_requests", "availability_requests"])
      expect(
        await admin(`select status from ${table} where cleaner_id=$1`, [
          f.cleaner,
        ]),
      ).toEqual([{ status: "declined" }]);
    const leave = (
      await admin<{ id: string }>(
        "select id from leave_requests where cleaner_id=$1",
        [f.cleaner],
      )
    )[0];
    await expect(
      admin("select review_request($1)", [
        JSON.stringify({ id: leave.id, kind: "leave", status: "approved" }),
      ]),
    ).rejects.toThrow(/history is read-only/);
  });
  it("does not suggest deleted customers for new conversations and keeps confirmed past associations", async () => {
    const f = await fixture();
    await admin("select delete_customer($1)", [f.customer]);
    const id = randomUUID();
    await db.query(
      "insert into conversations(id,provider,root_call_id,caller,suggested_customer_id) values($1::uuid,'fixture',$1::text,'+447700901234',$2)",
      [id, f.customer],
    );
    expect(
      (
        await admin<{ suggested_customer_id: null }>(
          "select suggested_customer_id from conversations where id=$1",
          [id],
        )
      )[0].suggested_customer_id,
    ).toBeNull();
    await expect(
      admin("select annotate_conversation($1)", [
        JSON.stringify({ id, customer_id: f.customer }),
      ]),
    ).rejects.toThrow(/customer has been deleted/);
  });
  it("rejects repeated removal and rolls back every change when deletion fails", async () => {
    const f = await fixture();
    await book(f);
    await db.exec(
      "create function reject_profile_deletion() returns trigger language plpgsql as $$ begin raise exception 'Synthetic failure'; end $$; create trigger reject_profile_deletion before update on customers for each row when (new.deleted_at is not null) execute function reject_profile_deletion();",
    );
    const before = await history(f);
    const pipeline = await admin(
      "select * from acquisition_leads where customer_id=$1",
      [f.customer],
    );
    try {
      await expect(
        admin("select delete_customer($1)", [f.customer]),
      ).rejects.toThrow(/Synthetic failure/);
      expect(await history(f)).toEqual(before);
      expect(
        await admin("select * from acquisition_leads where customer_id=$1", [
          f.customer,
        ]),
      ).toEqual(pipeline);
    } finally {
      await db.exec(
        "drop trigger reject_profile_deletion on customers;drop function reject_profile_deletion();",
      );
    }
    for (const kind of ["customer", "cleaner"] as const) {
      await admin(`select delete_${kind}($1)`, [f[kind]]);
      await expect(
        admin(`select delete_${kind}($1)`, [f[kind]]),
      ).rejects.toThrow(/not found/);
    }
  });
  it("matches blocking boundaries without treating completed, cancelled or unrelated work as active", () => {
    const now = Date.parse("2026-10-25T01:30:00Z");
    const base = {
      customer_id: "customer",
      cleaner_id: "cleaner",
      starts_at: "2026-10-25T01:00:00Z",
      ends_at: "2026-10-25T01:30:00Z",
      status: "scheduled",
    };
    const visits = [
      { ...base, id: "ended" },
      { ...base, id: "ongoing", ends_at: "2026-10-25T02:00:00Z" },
      { ...base, id: "started", status: "started" },
      {
        ...base,
        id: "completed",
        status: "completed",
        ends_at: "2200-01-01T09:00:00Z",
      },
      { ...base, id: "cancelled", status: "cancelled" },
      { ...base, id: "other", customer_id: "other", cleaner_id: "other" },
    ] as Visit[];
    expect(
      profileBlockingVisits(visits, "customer", "customer", now).map(
        (v) => v.id,
      ),
    ).toEqual(["ongoing", "started"]);
    expect(
      profileBlockingVisits(visits, "cleaner", "cleaner", now).map((v) => v.id),
    ).toEqual(["ongoing", "started"]);
  });
  it("applies the additive migration to old data and preserves all rows across repeat initialisation", async () => {
    const legacy = new PGlite({ extensions: { btree_gist } });
    try {
      await legacy.exec(localBootstrap);
      for (const name of [
        "202610020001_foundation.sql",
        "202610020004_transcription_jobs.sql",
        "202610030001_cleaner_availability.sql",
        "202610030002_recurring_bookings.sql",
        "202610030003_booking_finances.sql",
        "202610030004_customer_pipeline.sql",
        "202610030005_leave_cover.sql",
        "202610030006_series_deletion.sql",
      ])
        await legacy.exec(
          await fs.readFile(`supabase/migrations/${name}`, "utf8"),
        );
      await legacy.exec(
        `insert into auth.users(id) values('${DEMO_ADMIN}');update profiles set role='admin' where id='${DEMO_ADMIN}';insert into cleaners(id,name) values('${DEMO_ADMIN}','Synthetic migration profile');insert into customers(name) values('Migration fixture');`,
      );
      const tables = (
        await legacy.query<{ tablename: string }>(
          "select tablename from pg_tables where schemaname='public' order by tablename",
        )
      ).rows;
      const records = async () =>
        Promise.all(
          tables.map(
            async ({ tablename }) =>
              (
                await legacy.query(
                  `select to_jsonb(t)-'deleted_at' as row from public.${tablename} t order by to_jsonb(t)::text`,
                )
              ).rows,
          ),
        );
      const before = await records();
      await initialiseDatabase(legacy, true);
      expect(await records()).toEqual(before);
      await initialiseDatabase(legacy, true);
      expect(await records()).toEqual(before);
    } finally {
      await legacy.close();
    }
  });
});
