import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import {
  initialiseDatabase,
  DEMO_ADMIN,
  DEMO_CLEANER,
  DEMO_SECOND_CLEANER,
} from "@/lib/local-db";
import { operationSchema } from "@/lib/validation";

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
const service = <T = Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
) => query<T>("service_role", "", sql, values);
const rates = {
  customer_rate_pence: 1800,
  admin_rate_pence: 300,
  cleaner_rate_pence: 1500,
};
async function fixture() {
  const seq = ++sequence;
  const cid = (
    await admin<{ id: string }>("select save_customer($1) as id", [
      JSON.stringify({
        name: `Series Client ${seq}`,
        email: "series@example.test",
        phone: "",
        address: "12 Synthetic Lane",
        postcode: "ME14 1AA",
      }),
    ])
  )[0].id;
  const sid = (
    await admin<{ id: string }>("select create_booking($1) as id", [
      JSON.stringify({
        customer_id: cid,
        cleaner_id: DEMO_CLEANER,
        date: `${2090 + seq}-05-20`,
        time: "09:00",
        duration_minutes: 120,
        interval_weeks: 1,
        duration_weeks: 4,
        occurrences: 4,
        ...rates,
      }),
    ])
  )[0].id;
  const visits = await admin<{ id: string }>(
    "select id from visits where series_id=$1 order by starts_at",
    [sid],
  );
  return { cid, sid, visits };
}
async function snapshot(sid: string) {
  return {
    visits: await admin("select * from visits where series_id=$1 order by id", [
      sid,
    ]),
    finances: await admin(
      "select f.* from visit_finances f join visits v on v.id=f.id where v.series_id=$1 order by f.id",
      [sid],
    ),
    agreement: await admin("select * from series_finances where id=$1", [sid]),
  };
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await initialiseDatabase(db, true);
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("recurring series deletion", () => {
  it("validates the series identifier at the operation boundary", () => {
    expect(
      operationSchema.safeParse({
        action: "delete_series",
        data: { id: "wrong" },
      }).success,
    ).toBe(false);
    expect(
      operationSchema.safeParse({
        action: "delete_series",
        data: { id: "11111111-1111-4111-8111-111111111111" },
      }).success,
    ).toBe(true);
  });
  it("denies anonymous, cleaner and direct table deletion without exposing a series", async () => {
    const f = await fixture();
    await expect(
      query("anon", "", "select delete_booking_series($1)", [f.sid]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      query("authenticated", DEMO_CLEANER, "select delete_booking_series($1)", [
        f.sid,
      ]),
    ).rejects.toThrow(/Admin access/);
    await expect(
      admin("delete from booking_series where id=$1", [f.sid]),
    ).rejects.toThrow(/permission denied/);
    expect((await snapshot(f.sid)).visits).toHaveLength(4);
  });
  it("removes upcoming scheduled/cancelled visits and retains past, completed and started work with exact rates", async () => {
    const f = await fixture();
    await admin("select change_visit($1)", [
      JSON.stringify({ id: f.visits[1].id, status: "cancelled" }),
    ]);
    await query(
      "authenticated",
      DEMO_CLEANER,
      "select transition_visit($1,'started')",
      [f.visits[2].id],
    );
    await query(
      "authenticated",
      DEMO_CLEANER,
      "select transition_visit($1,'started')",
      [f.visits[3].id],
    );
    await query(
      "authenticated",
      DEMO_CLEANER,
      "select transition_visit($1,'completed')",
      [f.visits[3].id],
    );
    for (const [i, status] of [
      "scheduled",
      "completed",
      "cancelled",
    ].entries()) {
      const date = `2020-01-${String(1 + i + sequence * 3).padStart(2, "0")}`;
      const id = (
        await service<{ id: string }>(
          "insert into visits(series_id,customer_id,cleaner_id,starts_at,ends_at,status) values($1,$2,$3,($4::date+time '09:00') at time zone 'Europe/London',($4::date+time '11:00') at time zone 'Europe/London',$5) returning id",
          [f.sid, f.cid, DEMO_CLEANER, date, status],
        )
      )[0].id;
      await admin("select save_visit_finances($1)", [
        JSON.stringify({ id, ...rates }),
      ]);
    }
    const before = await snapshot(f.sid);
    const removeIds = [f.visits[0].id, f.visits[1].id];
    await admin("select delete_booking_series($1)", [f.sid]);
    const after = await snapshot(f.sid);
    expect(after.visits).toEqual(
      before.visits.filter((v) => !removeIds.includes(String(v.id))),
    );
    expect(after.finances).toEqual(
      before.finances.filter((v) => !removeIds.includes(String(v.id))),
    );
    expect(after.agreement).toEqual(before.agreement);
    const saved = (
      await admin<{ active: boolean; deleted_at: Date | null }>(
        "select active,deleted_at from booking_series where id=$1",
        [f.sid],
      )
    )[0];
    expect(saved.active).toBe(false);
    expect(saved.deleted_at).not.toBeNull();
    expect(
      await admin("select id from visits where id=any($1::uuid[])", [
        removeIds,
      ]),
    ).toHaveLength(0);
    expect(
      await admin("select id from visit_finances where id=any($1::uuid[])", [
        removeIds,
      ]),
    ).toHaveLength(0);
    expect(
      await admin("select id from customers where id=$1", [f.cid]),
    ).toHaveLength(1);
  });
  it("does not revalidate historical visits against changed working hours or inactive cleaners", async () => {
    const f = await fixture();
    await query(
      "authenticated",
      DEMO_CLEANER,
      "select transition_visit($1,'started')",
      [f.visits[0].id],
    );
    await query(
      "authenticated",
      DEMO_CLEANER,
      "select transition_visit($1,'completed')",
      [f.visits[0].id],
    );
    const before = (await snapshot(f.sid)).visits.find(
      (visit) => visit.id === f.visits[0].id,
    );
    await service("update cleaners set active=false where id=$1", [
      DEMO_CLEANER,
    ]);
    try {
      await admin("select delete_booking_series($1)", [f.sid]);
      expect((await snapshot(f.sid)).visits).toEqual([before]);
    } finally {
      await service("update cleaners set active=true where id=$1", [
        DEMO_CLEANER,
      ]);
    }
  });
  it("leaves other series and one-off visits intact and refreshes each affected cleaner safely", async () => {
    const f = await fixture();
    const other = await fixture();
    const before = await snapshot(other.sid);
    const oneOff = await admin(
      "select * from visits where series_id is null order by id",
    );
    await admin("select change_visit($1)", [
      JSON.stringify({ id: f.visits[0].id, cleaner_id: DEMO_SECOND_CLEANER }),
    ]);
    const paySignals = await admin<{ id: string; pay_updated_at: Date }>(
      "select id,pay_updated_at from cleaners order by id",
    );
    await admin("select delete_booking_series($1)", [f.sid]);
    expect(await snapshot(other.sid)).toEqual(before);
    expect(
      await admin("select * from visits where series_id is null order by id"),
    ).toEqual(oneOff);
    const afterSignals = await admin<{ id: string; pay_updated_at: Date }>(
      "select id,pay_updated_at from cleaners order by id",
    );
    expect(
      afterSignals.every(
        (signal, i) => signal.pay_updated_at > paySignals[i].pay_updated_at,
      ),
    ).toBe(true);
    expect(
      await admin(
        "select entity,operation from audit_records where entity_id=$1 and entity='booking_series' and operation='UPDATE'",
        [f.sid],
      ),
    ).toHaveLength(1);
    const lead = (
      await admin<{ stage: string }>(
        "select stage from acquisition_leads where customer_id=$1",
        [f.cid],
      )
    )[0];
    expect(lead.stage).toBe("opportunity");
  });
  it("rejects a repeated/stale deletion without changing retained financial history", async () => {
    const f = await fixture();
    await admin("select delete_booking_series($1)", [f.sid]);
    const before = await snapshot(f.sid);
    await expect(
      admin("select delete_booking_series($1)", [f.sid]),
    ).rejects.toThrow(/not found/);
    await expect(
      admin(
        "select delete_booking_series('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')",
      ),
    ).rejects.toThrow(/not found/);
    expect(await snapshot(f.sid)).toEqual(before);
  });
  it("rolls back visit/rate removal if the series update cannot complete", async () => {
    const f = await fixture();
    const before = await snapshot(f.sid);
    await db.exec(
      "create function reject_series_deletion() returns trigger language plpgsql as $$ begin raise exception 'Synthetic update failure'; end $$; create trigger reject_series_deletion before update on booking_series for each row when (new.deleted_at is not null) execute function reject_series_deletion();",
    );
    try {
      await expect(
        admin("select delete_booking_series($1)", [f.sid]),
      ).rejects.toThrow(/Synthetic update failure/);
      expect(await snapshot(f.sid)).toEqual(before);
      expect(
        (
          await admin<{ active: boolean }>(
            "select active from booking_series where id=$1",
            [f.sid],
          )
        )[0].active,
      ).toBe(true);
    } finally {
      await db.exec(
        "drop trigger reject_series_deletion on booking_series; drop function reject_series_deletion();",
      );
    }
  });
  it("upgrades existing data and repeated initialisation preserves records", async () => {
    await db.exec(
      "drop function delete_booking_series(uuid); alter table booking_series drop column deleted_at;",
    );
    const tables = (
      await db.query<{ tablename: string }>(
        "select tablename from pg_tables where schemaname='public' order by tablename",
      )
    ).rows;
    const records = async () =>
      Promise.all(
        tables.map(
          async ({ tablename }) =>
            (
              await db.query(
                `select to_jsonb(t) - 'deleted_at' as row from public.${tablename} t order by to_jsonb(t)::text`,
              )
            ).rows,
        ),
      );
    const before = await records();
    await initialiseDatabase(db, true);
    expect(await records()).toEqual(before);
    await initialiseDatabase(db, true);
    expect(await records()).toEqual(before);
  });
});
