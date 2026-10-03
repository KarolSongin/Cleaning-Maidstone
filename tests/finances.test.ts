import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import {
  initialiseDatabase,
  DEMO_ADMIN,
  DEMO_CLEANER,
  DEMO_SECOND_CLEANER,
} from "@/lib/local-db";
import { bookingSchema, bookingRatesSchema } from "@/lib/validation";
import {
  poundsToPence,
  ratesFromForm,
  visitAmounts,
  visitMinutes,
} from "@/lib/finances";
const rates = {
  customer_rate_pence: 1800,
  admin_rate_pence: 300,
  cleaner_rate_pence: 1500,
};
const customer = "44444444-4444-4444-8444-444444444444";
const booking = (date: string, extra: Record<string, unknown> = {}) => ({
  ...rates,
  customer_id: customer,
  cleaner_id: DEMO_CLEANER,
  date,
  time: "14:00",
  duration_minutes: 90,
  interval_weeks: 0,
  occurrences: 1,
  ...extra,
});
describe("pound amounts and penny allocation", () => {
  it("parses money exactly, rejecting missing, negative, fractional pennies and excessive rates", () => {
    expect(poundsToPence("18")).toBe(1800);
    expect(poundsToPence("18.10")).toBe(1810);
    expect(poundsToPence("0.29")).toBe(29);
    expect(poundsToPence("1000.00")).toBe(100000);
    for (const value of [
      "",
      "-1",
      "18.001",
      "1000.01",
      "1e2",
      "Infinity",
      "18,50",
    ])
      expect(poundsToPence(value)).toBeNull();
  });
  it("prices partial hours and keeps customer = admin + cleaner after rounding", () => {
    expect(visitAmounts(rates, 180)).toEqual({
      customer: 5400,
      admin: 900,
      cleaner: 4500,
    });
    expect(visitAmounts(rates, 90)).toEqual({
      customer: 2700,
      admin: 450,
      cleaner: 2250,
    });
    expect(visitAmounts(rates, 45)).toEqual({
      customer: 1350,
      admin: 225,
      cleaner: 1125,
    });
    // Round the cleaner's agreed cash pay independently; admin keeps the remainder.
    expect(
      visitAmounts(
        {
          customer_rate_pence: 1802,
          admin_rate_pence: 301,
          cleaner_rate_pence: 1501,
        },
        30,
      ),
    ).toEqual({ customer: 901, admin: 150, cleaner: 751 });
    expect(
      visitMinutes({
        starts_at: "2027-03-28T08:00:00Z",
        ends_at: "2027-03-28T09:30:00Z",
      }),
    ).toBe(90);
  });
  it("rejects inconsistent splits at the form and API boundaries, including free or missing customer rates", () => {
    expect(bookingSchema.safeParse(booking("2039-01-04")).success).toBe(true);
    for (const extra of [
      { admin_rate_pence: 299 },
      { cleaner_rate_pence: -1 },
      { customer_rate_pence: 1800.5 },
      { customer_rate_pence: 0, admin_rate_pence: 0, cleaner_rate_pence: 0 },
      { customer_rate_pence: undefined },
      { cleaner_rate_pence: 100001 },
    ])
      expect(
        bookingSchema.safeParse(booking("2039-01-04", extra)).success,
      ).toBe(false);
    expect(bookingRatesSchema.safeParse(rates).success).toBe(true);
    const form = new FormData();
    form.set("customer_rate", "18.10");
    form.set("admin_rate", "3.10");
    form.set("cleaner_rate", "15");
    expect(ratesFromForm(form)).toEqual({
      ...rates,
      customer_rate_pence: 1810,
      admin_rate_pence: 310,
    });
    form.set("cleaner_rate", "14");
    expect(() => ratesFromForm(form)).toThrow(/must equal/);
    form.set("cleaner_rate", "");
    expect(() => ratesFromForm(form)).toThrow(/Enter hourly amounts/);
  });
});

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
const cleaner = <T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
) => query<T>("authenticated", DEMO_CLEANER, sql, args);
async function create(date: string, extra: Record<string, unknown> = {}) {
  return (
    await admin<{ id: string }>("select create_booking($1) as id", [
      JSON.stringify(booking(date, extra)),
    ])
  )[0].id;
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec("create publication supabase_realtime");
  await initialiseDatabase(db, true);
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("financial snapshots and permissions", () => {
  it("leaves historical seed visits unpriced and migrates idempotently", async () => {
    expect(await admin("select * from visit_finances")).toEqual([]);
    expect(await admin("select * from series_finances")).toEqual([]);
    const jobs = await cleaner("select * from cleaner_jobs()");
    expect(jobs[0].cleaner_rate_pence).toBeNull();
    expect(jobs[0].cleaner_total_pence).toBeNull();
    const visits = (await db.query("select * from visits order by id")).rows;
    await initialiseDatabase(db, true);
    expect((await db.query("select * from visits order by id")).rows).toEqual(
      visits,
    );
    expect(await admin("select * from visit_finances")).toEqual([]);
  });
  it("stores a one-off split and exposes only the assigned cleaner's cash rate and pay", async () => {
    const id = await create("2039-01-04");
    expect(
      await admin("select * from visit_finances where id=$1", [id]),
    ).toEqual([{ id, ...rates }]);
    const jobs = await cleaner("select * from cleaner_jobs() where id=$1", [
      id,
    ]);
    expect(jobs[0]).toMatchObject({
      id,
      cleaner_rate_pence: 1500,
      cleaner_total_pence: 2250,
    });
    expect(Object.keys(jobs[0]).sort()).toEqual(
      [
        "id",
        "starts_at",
        "ends_at",
        "status",
        "instructions",
        "customer_name",
        "address",
        "postcode",
        "cleaner_rate_pence",
        "cleaner_total_pence",
      ].sort(),
    );
    expect(
      await query(
        "authenticated",
        DEMO_SECOND_CLEANER,
        "select * from cleaner_jobs() where id=$1",
        [id],
      ),
    ).toEqual([]);
    expect(await cleaner("select * from visit_finances")).toEqual([]);
    expect(await cleaner("select * from series_finances")).toEqual([]);
    expect(
      await cleaner(
        "select f.* from visit_finances f join visits v on v.id=f.id",
      ),
    ).toEqual([]);
    await expect(
      query("anon", "", "select * from visit_finances"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      query("anon", "", "select * from series_finances"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      query("anon", "", "select * from cleaner_jobs()"),
    ).rejects.toThrow(/permission denied/);
    expect(
      (
        await db.query<{ tablename: string }>(
          "select tablename from pg_publication_tables where pubname='supabase_realtime'",
        )
      ).rows.map((row) => row.tablename),
    ).toContain("cleaners");
    const columns = (
      await db.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_name='visits'",
      )
    ).rows;
    expect(columns.some((c) => /rate|pence|finance/.test(c.column_name))).toBe(
      false,
    );
    expect(
      (
        await db.query(
          "select * from pg_publication_tables where tablename in ('visit_finances','series_finances')",
        )
      ).rows,
    ).toEqual([]);
  });
  it("snapshots the original split into all 52 weekly visits and preserves it on reschedule", async () => {
    const id = await create("2035-01-01", {
      interval_weeks: 1,
      occurrences: 52,
      duration_weeks: 52,
    });
    expect(
      await admin("select * from series_finances where id=$1", [id]),
    ).toEqual([{ id, ...rates }]);
    const finances = await admin(
      "select f.* from visit_finances f join visits v on v.id=f.id where v.series_id=$1 order by v.starts_at",
      [id],
    );
    expect(finances).toHaveLength(52);
    for (const f of finances) expect(f).toMatchObject(rates);
    const first = String(finances[0].id);
    await admin("select change_visit($1)", [
      JSON.stringify({ id: first, starts_at: "2035-01-01T16:00:00Z" }),
    ]);
    expect(
      await admin("select * from visit_finances where id=$1", [first]),
    ).toEqual([finances[0]]);
    await admin("select save_visit_finances($1)", [
      JSON.stringify({
        id: first,
        customer_rate_pence: 2000,
        admin_rate_pence: 400,
        cleaner_rate_pence: 1600,
      }),
    ]);
    expect(
      (await cleaner("select * from cleaner_jobs() where id=$1", [first]))[0],
    ).toMatchObject({ cleaner_rate_pence: 1600, cleaner_total_pence: 2400 });
    const siblings = await admin(
      "select f.* from visit_finances f join visits v on v.id=f.id where v.series_id=$1 and v.id<>$2",
      [id, first],
    );
    expect(siblings).toHaveLength(51);
    for (const f of siblings) expect(f).toMatchObject(rates);
    expect(
      (await admin("select * from series_finances where id=$1", [id]))[0],
    ).toMatchObject(rates);
  });
  it("supports zero shares, prices old visits, audits changes and refreshes the cleaner without exposing amounts", async () => {
    const [old] = await admin<{ id: string }>(
      "select v.id from visits v left join visit_finances f on f.id=v.id where f.id is null limit 1",
    );
    const [before] = await admin<{ pay_updated_at: Date }>(
      "select pay_updated_at from cleaners where id=$1",
      [DEMO_CLEANER],
    );
    await admin("select save_visit_finances($1)", [
      JSON.stringify({
        id: old.id,
        ...rates,
        admin_rate_pence: 0,
        cleaner_rate_pence: 1800,
      }),
    ]);
    expect(
      (await cleaner("select * from cleaner_jobs() where id=$1", [old.id]))[0],
    ).toMatchObject({ cleaner_rate_pence: 1800, cleaner_total_pence: 5400 });
    const [after] = await admin<{ pay_updated_at: Date }>(
      "select pay_updated_at from cleaners where id=$1",
      [DEMO_CLEANER],
    );
    expect(after.pay_updated_at.getTime()).toBeGreaterThan(
      before.pay_updated_at.getTime(),
    );
    expect(
      await admin(
        "select entity,actor_id,operation from audit_records where entity='visit_finances' and entity_id=$1",
        [old.id],
      ),
    ).toContainEqual({
      entity: "visit_finances",
      actor_id: DEMO_ADMIN,
      operation: "INSERT",
    });
    expect(await cleaner("select * from audit_records")).toEqual([]);
    const id = await create("2039-02-04", {
      cleaner_rate_pence: 0,
      admin_rate_pence: 1800,
    });
    expect(
      (await cleaner("select * from cleaner_jobs() where id=$1", [id]))[0],
    ).toMatchObject({ cleaner_rate_pence: 0, cleaner_total_pence: 0 });
  });
  it("allows only admin edits and prevents unpriced or unbalanced new bookings even through direct RPC", async () => {
    const id = await create("2039-03-04");
    await expect(
      cleaner("select save_visit_finances($1)", [
        JSON.stringify({ id, ...rates }),
      ]),
    ).rejects.toThrow(/Admin access/);
    await expect(
      cleaner("update visit_finances set customer_rate_pence=1 where id=$1", [
        id,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      cleaner("select create_booking($1)", [
        JSON.stringify(booking("2039-03-05")),
      ]),
    ).rejects.toThrow(/Admin access/);
    await expect(
      query("anon", "", "select save_visit_finances($1)", [
        JSON.stringify({ id, ...rates }),
      ]),
    ).rejects.toThrow(/permission denied/);
    for (const extra of [
      { cleaner_rate_pence: undefined },
      { admin_rate_pence: 299 },
      { customer_rate_pence: 1800.5 },
      { cleaner_rate_pence: -1500 },
      { customer_rate_pence: 100001 },
      { admin_rate_pence: "300" },
      { customer_rate_pence: 0, admin_rate_pence: 0, cleaner_rate_pence: 0 },
    ]) {
      await expect(
        admin("select create_booking($1)", [
          JSON.stringify(booking("2039-03-05", extra)),
        ]),
      ).rejects.toThrow(/rate|pennies/);
      await expect(
        admin("select save_visit_finances($1)", [
          JSON.stringify({ id, ...rates, ...extra }),
        ]),
      ).rejects.toThrow(/rate|pennies/);
    }
    expect(
      await admin("select * from visit_finances where id=$1", [id]),
    ).toEqual([{ id, ...rates }]);
  });
  it("keeps precision identical in SQL and previews and transfers pay visibility on reassignment", async () => {
    const rounded = {
      customer_rate_pence: 1802,
      admin_rate_pence: 301,
      cleaner_rate_pence: 1501,
    };
    const id = await create("2039-04-04", { ...rounded, duration_minutes: 30 });
    expect(
      (await cleaner("select * from cleaner_jobs() where id=$1", [id]))[0]
        .cleaner_total_pence,
    ).toBe(visitAmounts(rounded, 30).cleaner);
    await admin("select change_visit($1)", [
      JSON.stringify({ id, cleaner_id: DEMO_SECOND_CLEANER }),
    ]);
    expect(
      await cleaner("select * from cleaner_jobs() where id=$1", [id]),
    ).toEqual([]);
    expect(
      (
        await query(
          "authenticated",
          DEMO_SECOND_CLEANER,
          "select * from cleaner_jobs() where id=$1",
          [id],
        )
      )[0].cleaner_total_pence,
    ).toBe(751);
    await admin("select change_visit($1)", [
      JSON.stringify({ id, status: "cancelled" }),
    ]);
    expect(
      await query(
        "authenticated",
        DEMO_SECOND_CLEANER,
        "select * from cleaner_jobs() where id=$1",
        [id],
      ),
    ).toEqual([]);
    expect(
      await admin("select * from visit_finances where id=$1", [id]),
    ).toEqual([{ id, ...rounded }]);
  });
  it("rolls back series, visit and financial rows together when a later occurrence conflicts", async () => {
    await create("2039-05-18");
    const before = await admin(
      "select (select count(*) from visits) as visits,(select count(*) from booking_series) as series,(select count(*) from visit_finances) as finances,(select count(*) from series_finances) as series_finances",
    );
    await expect(
      create("2039-05-04", {
        interval_weeks: 1,
        occurrences: 3,
        duration_weeks: 3,
      }),
    ).rejects.toThrow(/overlap/);
    expect(
      await admin(
        "select (select count(*) from visits) as visits,(select count(*) from booking_series) as series,(select count(*) from visit_finances) as finances,(select count(*) from series_finances) as series_finances",
      ),
    ).toEqual(before);
  });
});
