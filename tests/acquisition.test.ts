import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import {
  initialiseDatabase,
  localBootstrap,
  DEMO_ADMIN,
  DEMO_CLEANER,
} from "@/lib/local-db";
import { opportunitySchema, operationSchema } from "@/lib/validation";
import { contactDueOn, contactIsDue } from "@/lib/acquisition";
import type { AcquisitionLead, AcquisitionStage } from "@/lib/models";
import fs from "node:fs/promises";

let db: PGlite;
let sequence = 0;
async function query<T = Record<string, unknown>>(
  role: string,
  id: string,
  sql: string,
  values: unknown[] = [],
) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
    return (await tx.query<T>(sql, values)).rows;
  });
}
const admin = <T = Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
) => query<T>("authenticated", DEMO_ADMIN, sql, values);
const cleaner = <T = Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
) => query<T>("authenticated", DEMO_CLEANER, sql, values);
const service = <T = Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
) => query<T>("service_role", "", sql, values);
const profile = (name: string, extra = {}) => ({
  name,
  email: "pipeline@example.test",
  phone: "07700900999",
  address: "12 Synthetic Street",
  postcode: "ME14 1AA",
  preferences: "Kitchen first",
  internal_notes: "Private profile note",
  ...extra,
});
async function opportunity(extra: Record<string, unknown> = {}) {
  return (
    await admin<{ id: string }>("select save_opportunity($1) as id", [
      JSON.stringify({
        name: `Prospect ${++sequence}`,
        email: "pipeline@example.test",
        phone: "",
        notes: "Private pipeline note",
        ...extra,
      }),
    ])
  )[0].id;
}
async function getLead(id: string) {
  return (
    await admin<{ lead: AcquisitionLead }>(
      "select to_jsonb(l) as lead from acquisition_leads l where id=$1",
      [id],
    )
  )[0].lead;
}
async function customer(extra: Record<string, unknown> = {}) {
  const cid = (
    await admin<{ id: string }>("select save_customer($1) as id", [
      JSON.stringify(profile(`Customer ${++sequence}`, extra)),
    ])
  )[0].id;
  const lid = (
    await admin<{ id: string }>(
      "select id from acquisition_leads where customer_id=$1",
      [cid],
    )
  )[0].id;
  return { cid, lid };
}
async function stage(lid: string, target: string, expected?: AcquisitionStage) {
  return admin("select set_pipeline_stage($1)", [
    JSON.stringify({
      id: lid,
      stage: target,
      expected_stage: expected ?? (await getLead(lid)).stage,
      note: "Agreed next step with customer",
    }),
  ]);
}
async function book(
  cid: string,
  date: string,
  extra: Record<string, unknown> = {},
) {
  return (
    await admin<{ id: string }>("select create_booking($1) as id", [
      JSON.stringify({
        customer_id: cid,
        cleaner_id: DEMO_CLEANER,
        date,
        time: "14:00",
        duration_minutes: 60,
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
async function relativeDate(days: number) {
  return (
    await db.query<{ date: string }>(
      "select to_char((now() at time zone 'Europe/London')::date+$1::int,'YYYY-MM-DD') as date",
      [days],
    )
  ).rows[0].date;
}
const changeVisit = (id: string, extra: Record<string, unknown>) =>
  admin("select change_visit($1)", [JSON.stringify({ id, ...extra })]);

beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec("create publication supabase_realtime");
  await initialiseDatabase(db, true);
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("intake and linked customer records", () => {
  it("creates a private website opportunity and enquiry together, and keeps their stage in sync", async () => {
    const eid = (
      await service<{ id: string }>("select submit_enquiry($1,$2) as id", [
        JSON.stringify({
          name: "Website prospect",
          email: "website@example.test",
          phone: "07700900999",
          postcode: "ME14 1AA",
          frequency: "weekly",
          home_size: "2 bedrooms",
          preferred_days: ["Tuesday"],
          notes: "Website message",
        }),
        "pipeline-test",
      ])
    )[0].id;
    const [{ pipeline_id }] = await admin<{ pipeline_id: string }>(
      "select pipeline_id from enquiries where id=$1",
      [eid],
    );
    expect(await getLead(pipeline_id)).toMatchObject({
      source: "website",
      stage: "opportunity",
      customer_id: null,
      notes: "Website message",
    });
    await stage(pipeline_id, "contacted");
    await stage(pipeline_id, "quoted");
    expect(
      (await admin("select status from enquiries where id=$1", [eid]))[0]
        .status,
    ).toBe("contacted");
    expect(
      (
        await admin("select * from acquisition_history where lead_id=$1", [
          pipeline_id,
        ])
      ).length,
    ).toBe(3);
    await expect(
      admin("select update_enquiry($1,'converted')", [eid]),
    ).rejects.toThrow(/pipeline/);
  });
  it("takes a manual opportunity without an address and validates a way to contact them", async () => {
    const lid = await opportunity({
      email: "",
      phone: "07700900998",
      next_contact_on: "2038-01-10",
    });
    expect(await getLead(lid)).toMatchObject({
      source: "manual",
      stage: "opportunity",
      customer_id: null,
      next_contact_on: "2038-01-10",
    });
    await expect(stage(lid, "onboarded")).rejects.toThrow(
      /customer profile before confirming/,
    );
    expect(
      opportunitySchema.safeParse({ name: "No contact", email: "", phone: "" })
        .success,
    ).toBe(false);
    await expect(opportunity({ email: "", phone: "" })).rejects.toThrow(
      /email address or phone/,
    );
    expect(
      operationSchema.safeParse({
        action: "pipeline_stage",
        data: {
          id: lid,
          expected_stage: "opportunity",
          stage: "recurring_follow_up",
        },
      }).success,
    ).toBe(false);
  });
  it("starts a manual customer in Opportunity and edits the same linked record", async () => {
    const { cid, lid } = await customer();
    expect((await getLead(lid)).stage).toBe("opportunity");
    await stage(lid, "quoted");
    await admin("select save_customer($1)", [
      JSON.stringify(profile("Edited customer", { id: cid })),
    ]);
    expect(await getLead(lid)).toMatchObject({
      name: "Edited customer",
      stage: "quoted",
    });
    expect(
      (
        await admin("select id from acquisition_leads where customer_id=$1", [
          cid,
        ])
      ).length,
    ).toBe(1);
  });
  it("converts the same opportunity twice without duplicate customers, leads or linking events", async () => {
    const lid = await opportunity();
    await stage(lid, "quoted");
    const p = profile("Converted prospect", { pipeline_id: lid });
    const first = (
      await admin<{ id: string }>("select save_customer($1) as id", [
        JSON.stringify(p),
      ])
    )[0].id;
    const second = (
      await admin<{ id: string }>("select save_customer($1) as id", [
        JSON.stringify(p),
      ])
    )[0].id;
    expect(first).toBe(second);
    expect(await getLead(lid)).toMatchObject({
      customer_id: first,
      stage: "quoted",
    });
    expect(
      (
        await admin(
          "select * from acquisition_history where lead_id=$1 and reason='linked'",
          [lid],
        )
      ).length,
    ).toBe(1);
    await expect(
      admin("select save_customer($1)", [
        JSON.stringify({ ...p, id: "44444444-4444-4444-8444-444444444444" }),
      ]),
    ).rejects.toThrow(/already has a customer/);
  });
  it("links a website enquiry to an existing customer and retains stage, notes and both histories", async () => {
    const { cid, lid } = await customer();
    await stage(lid, "onboarded");
    const eid = (
      await service<{ id: string }>("select submit_enquiry($1,$2) as id", [
        JSON.stringify({
          name: "Returning customer enquiry",
          email: "return@example.test",
          phone: "07700900999",
          postcode: "ME14 1AA",
          frequency: "discuss",
          home_size: "3 bedrooms",
          preferred_days: [],
          notes: "Extra enquiry details",
        }),
        "return-test",
      ])
    )[0].id;
    const incoming = (
      await admin<{ pipeline_id: string }>(
        "select pipeline_id from enquiries where id=$1",
        [eid],
      )
    )[0].pipeline_id;
    await stage(incoming, "contacted");
    await admin("select save_customer($1)", [
      JSON.stringify(
        profile("Existing linked customer", { id: cid, pipeline_id: incoming }),
      ),
    ]);
    expect(
      (await admin("select id from acquisition_leads where id=$1", [incoming]))
        .length,
    ).toBe(0);
    expect(await getLead(lid)).toMatchObject({
      stage: "onboarded",
      notes: "Extra enquiry details",
    });
    expect(
      (
        await admin(
          "select pipeline_id,customer_id,status from enquiries where id=$1",
          [eid],
        )
      )[0],
    ).toMatchObject({
      pipeline_id: lid,
      customer_id: cid,
      status: "converted",
    });
    expect(
      (await admin("select * from acquisition_history where lead_id=$1", [lid]))
        .length,
    ).toBe(5);
  });
  it("preserves the original enquiry linkage when making a new customer profile", async () => {
    const eid = (
      await service<{ id: string }>("select submit_enquiry($1,$2) as id", [
        JSON.stringify({
          name: "New enquiry conversion",
          email: "new@example.test",
          phone: "07700900999",
          postcode: "ME14 1AA",
          frequency: "fortnightly",
          home_size: "1 bedroom",
          preferred_days: [],
          notes: "Message retained",
        }),
        "new-test",
      ])
    )[0].id;
    const lid = (
      await admin<{ pipeline_id: string }>(
        "select pipeline_id from enquiries where id=$1",
        [eid],
      )
    )[0].pipeline_id;
    const [{ id: cid }] = await admin<{ id: string }>(
      "select save_customer($1) as id",
      [JSON.stringify(profile("New enquiry conversion", { pipeline_id: lid }))],
    );
    expect(
      (
        await admin(
          "select pipeline_id,customer_id,notes from enquiries where id=$1",
          [eid],
        )
      )[0],
    ).toEqual({
      pipeline_id: lid,
      customer_id: cid,
      notes: "Message retained",
    });
    expect((await getLead(lid)).stage).toBe("opportunity");
  });
});

describe("first cleaning and date-driven follow-up", () => {
  it("books the first visit automatically and follows a reschedule rather than the original date", async () => {
    const { cid, lid } = await customer();
    await stage(lid, "quoted");
    const vid = await book(cid, "2038-01-04");
    expect(await getLead(lid)).toMatchObject({
      stage: "first_clean_booked",
      stage_before_booking: "quoted",
      first_visit_id: vid,
      first_clean_on: "2038-01-04",
      follow_up_due_on: "2038-01-05",
    });
    await changeVisit(vid, { starts_at: "2038-01-08T14:00:00Z" });
    expect(await getLead(lid)).toMatchObject({
      first_clean_on: "2038-01-08",
      follow_up_due_on: "2038-01-09",
    });
    await expect(stage(lid, "quoted")).rejects.toThrow(
      /first cleaning controls/,
    );
  });
  it("returns a cancelled first clean to the prior quote stage, and a new booking starts the first-clean stage again", async () => {
    const { cid, lid } = await customer();
    await stage(lid, "quoted");
    const vid = await book(cid, "2038-02-01");
    await changeVisit(vid, { status: "cancelled" });
    expect(await getLead(lid)).toMatchObject({
      stage: "quoted",
      first_visit_id: null,
      first_clean_on: null,
      follow_up_due_on: null,
    });
    const replacement = await book(cid, "2038-02-02");
    expect(await getLead(lid)).toMatchObject({
      stage: "first_clean_booked",
      first_visit_id: replacement,
    });
  });
  it("uses the next active recurrence if the first occurrence is cancelled; recurrence alone never onboards", async () => {
    const { cid, lid } = await customer();
    const sid = await book(cid, "2038-03-01", {
      interval_weeks: 1,
      occurrences: 52,
      duration_weeks: 52,
    });
    const visits = await admin<{ id: string }>(
      "select id from visits where series_id=$1 order by starts_at",
      [sid],
    );
    expect((await getLead(lid)).stage).toBe("first_clean_booked");
    await changeVisit(visits[0].id, { status: "cancelled" });
    expect(await getLead(lid)).toMatchObject({
      first_visit_id: visits[1].id,
      first_clean_on: "2038-03-08",
    });
    expect(
      (
        await admin(
          "select * from acquisition_history where lead_id=$1 and reason='booking'",
          [lid],
        )
      ).length,
    ).toBe(1);
  });
  it("moves a past first cleaning to recurring follow-up and materialises catch-up once across repeated dashboard/job runs", async () => {
    const { cid, lid } = await customer();
    const date = await relativeDate(-3);
    await book(cid, date);
    expect((await getLead(lid)).stage).toBe("recurring_follow_up");
    // Represents the persisted stage from before UK midnight while the scheduler was offline.
    await db.query(
      "update acquisition_leads set stage='first_clean_booked' where id=$1",
      [lid],
    );
    const before = (
      await admin("select id from acquisition_history where lead_id=$1", [lid])
    ).length;
    await admin("select sync_customer_pipeline()");
    await admin("select sync_customer_pipeline()");
    await service("select run_customer_pipeline_job()");
    expect(await getLead(lid)).toMatchObject({
      stage: "recurring_follow_up",
      first_clean_on: date,
    });
    expect(
      (
        await admin("select id from acquisition_history where lead_id=$1", [
          lid,
        ])
      ).length,
    ).toBe(before + 1);
    await changeVisit((await getLead(lid)).first_visit_id!, {
      starts_at: "2038-05-04T13:00:00Z",
    });
    expect((await getLead(lid)).stage).toBe("first_clean_booked");
  });
  it("keeps a first clean on today's date in booked stage even when marked complete", async () => {
    const { cid, lid } = await customer();
    const vid = await book(cid, await relativeDate(0));
    await cleaner("select transition_visit($1,'started')", [vid]);
    await cleaner("select transition_visit($1,'completed')", [vid]);
    expect((await getLead(lid)).stage).toBe("first_clean_booked");
  });
  it.each([
    ["2026-10-24T13:00:00Z", "2026-10-24T22:59:59Z", "first_clean_booked"],
    ["2026-10-24T13:00:00Z", "2026-10-24T23:00:00Z", "recurring_follow_up"],
    ["2026-10-25T14:00:00Z", "2026-10-25T23:59:59Z", "first_clean_booked"],
    ["2026-10-25T14:00:00Z", "2026-10-26T00:00:00Z", "recurring_follow_up"],
    ["2027-03-28T13:00:00Z", "2027-03-28T23:00:00Z", "recurring_follow_up"],
  ])(
    "uses UK midnight across clock changes (%s / %s)",
    async (first, asOf, expected) => {
      expect(
        (
          await db.query<{ stage: string }>(
            "select pipeline_booking_stage($1,$2) as stage",
            [first, asOf],
          )
        ).rows[0].stage,
      ).toBe(expected);
    },
  );
  it("keeps confirmed onboarding after schedule changes and rejects stale stage edits", async () => {
    const { cid, lid } = await customer();
    const vid = await book(cid, "2040-01-03");
    await expect(stage(lid, "onboarded", "opportunity")).rejects.toThrow(
      /stage has changed/,
    );
    await stage(lid, "onboarded");
    await changeVisit(vid, { status: "cancelled" });
    await admin("select sync_customer_pipeline()");
    expect((await getLead(lid)).stage).toBe("onboarded");
    await stage(lid, "closed");
    await stage(lid, "opportunity");
    expect((await getLead(lid)).stage).toBe("opportunity");
  });
  it("rolls back a first-clean stage and its history if a later recurring visit conflicts", async () => {
    const { cid, lid } = await customer();
    const blocking = await customer();
    await book(blocking.cid, "2041-01-11");
    const count = (
      await admin("select id from acquisition_history where lead_id=$1", [lid])
    ).length;
    await expect(
      book(cid, "2041-01-04", {
        interval_weeks: 1,
        occurrences: 3,
        duration_weeks: 3,
      }),
    ).rejects.toThrow(/overlap|conflict/);
    expect((await getLead(lid)).stage).toBe("opportunity");
    expect(
      (
        await admin("select id from acquisition_history where lead_id=$1", [
          lid,
        ])
      ).length,
    ).toBe(count);
    expect(
      await admin("select id from visits where customer_id=$1", [cid]),
    ).toEqual([]);
  });
});

describe("private acquisition data and reminders", () => {
  it("denies public/cleaner reads and edits, and keeps the tables out of Realtime", async () => {
    for (const table of ["acquisition_leads", "acquisition_history"]) {
      expect(await cleaner(`select * from ${table}`)).toEqual([]);
      await expect(query("anon", "", `select * from ${table}`)).rejects.toThrow(
        /permission denied/,
      );
      await expect(admin(`delete from ${table}`)).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(cleaner("select sync_customer_pipeline()")).rejects.toThrow(
      /Admin/,
    );
    await expect(
      cleaner("select save_opportunity($1)", [
        JSON.stringify({ name: "Attack", email: "attack@example.test" }),
      ]),
    ).rejects.toThrow(/Admin/);
    await expect(
      cleaner("select set_pipeline_stage($1)", [
        JSON.stringify({
          id: "44444444-4444-4444-8444-444444444444",
          stage: "onboarded",
        }),
      ]),
    ).rejects.toThrow(/Admin/);
    for (const role of ["authenticated", "anon"])
      await expect(
        query(role, DEMO_ADMIN, "select run_customer_pipeline_job()"),
      ).rejects.toThrow(/permission denied/);
    await expect(admin("select sync_pipeline_internal()")).rejects.toThrow(
      /permission denied/,
    );
    expect(
      (
        await db.query(
          "select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename in ('acquisition_leads','acquisition_history')",
        )
      ).rows,
    ).toEqual([]);
  });
  it("honours a next-contact date and stops acquisition reminders for closed or onboarded clients", () => {
    const lead = {
      stage: "recurring_follow_up",
      follow_up_due_on: "2026-10-03",
      next_contact_on: null,
    } as AcquisitionLead;
    expect(contactDueOn(lead)).toBe("2026-10-03");
    expect(contactIsDue(lead, "2026-10-03")).toBe(true);
    expect(
      contactIsDue({ ...lead, next_contact_on: "2026-10-05" }, "2026-10-03"),
    ).toBe(false);
    expect(
      contactIsDue(
        { ...lead, stage: "quoted", next_contact_on: "2026-10-02" },
        "2026-10-03",
      ),
    ).toBe(true);
    for (const stage of ["onboarded", "closed"] as const)
      expect(contactDueOn({ ...lead, stage })).toBeNull();
  });
  it("migrates existing customers, enquiries and bookings without replacing them or assuming regular agreements", async () => {
    const legacy = new PGlite({ extensions: { btree_gist } });
    try {
      await legacy.exec(localBootstrap);
      for (const name of [
        "202610020001_foundation.sql",
        "202610020004_transcription_jobs.sql",
        "202610030001_cleaner_availability.sql",
        "202610030002_recurring_bookings.sql",
        "202610030003_booking_finances.sql",
      ])
        await legacy.exec(
          await fs.readFile(`supabase/migrations/${name}`, "utf8"),
        );
      await legacy.exec(`insert into auth.users(id) values('${DEMO_ADMIN}'),('${DEMO_CLEANER}'); update profiles set role='admin' where id='${DEMO_ADMIN}'; insert into cleaners(id,name) values('${DEMO_CLEANER}','Legacy cleaner'); insert into availability(cleaner_id,weekday,start_time,end_time) select '${DEMO_CLEANER}',d,'08:00','20:00' from generate_series(0,6) d;
        insert into customers(id,name,email,phone,address,postcode,internal_notes) values('44444444-4444-4444-8444-444444444444','Legacy customer','legacy@example.test','07700900111','Legacy synthetic address','ME14 1AA','Retain this');
        insert into enquiries(customer_id,name,email,phone,postcode,frequency,home_size,notes,status) values('44444444-4444-4444-8444-444444444444','Legacy customer','legacy@example.test','07700900111','ME14 1AA','weekly','2 bedrooms','Keep request','contacted');
        insert into enquiries(name,email,phone,postcode,frequency,home_size,notes,status) values('Closed lead','closed@example.test','07700900222','ME15 1AA','discuss','1 bedroom','Old closed enquiry','closed');
        insert into visits(customer_id,cleaner_id,starts_at,ends_at) values('44444444-4444-4444-8444-444444444444','${DEMO_CLEANER}',(((now() at time zone 'Europe/London')::date-5)+time '09:00') at time zone 'Europe/London',(((now() at time zone 'Europe/London')::date-5)+time '10:00') at time zone 'Europe/London');`);
      const before = {} as Record<string, unknown[]>;
      for (const t of ["customers", "enquiries", "visits", "availability"])
        before[t] = (
          await legacy.query(
            `select to_jsonb(t) as row from ${t} t order by id`,
          )
        ).rows.map((r) => (r as { row: unknown }).row);
      await initialiseDatabase(legacy, true);
      await initialiseDatabase(legacy, true);
      for (const t of ["customers", "enquiries", "visits", "availability"])
        expect(
          (
            await legacy.query(
              `select to_jsonb(t)${t === "enquiries" ? "-'pipeline_id'" : t === "customers" ? "-'deleted_at'" : ""} as row from ${t} t order by id`,
            )
          ).rows.map((r) => (r as { row: unknown }).row),
        ).toEqual(before[t]);
      expect(
        (await legacy.query("select deleted_at from customers")).rows,
      ).toEqual([{ deleted_at: null }]);
      expect(
        (
          await legacy.query(
            "select stage from acquisition_leads where customer_id is not null",
          )
        ).rows,
      ).toEqual([{ stage: "recurring_follow_up" }]);
      expect(
        (
          await legacy.query(
            "select stage from acquisition_leads where name='Closed lead'",
          )
        ).rows,
      ).toEqual([{ stage: "closed" }]);
      expect(
        (await legacy.query("select * from acquisition_leads")).rows.length,
      ).toBe(2);
    } finally {
      await legacy.close();
    }
  });
});
