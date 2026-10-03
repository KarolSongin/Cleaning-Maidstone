import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import {
  initialiseDatabase,
  DEMO_ADMIN,
  DEMO_CLEANER,
  DEMO_SECOND_CLEANER,
  localBootstrap,
} from "@/lib/local-db";
import { occurrenceInstants } from "@/lib/scheduling";
import fs from "node:fs/promises";
const customer = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
async function query<T>(
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
const admin = <T>(sql: string, args: unknown[] = []) =>
  query<T>("authenticated", DEMO_ADMIN, sql, args);
const cleaner = <T>(sql: string, args: unknown[] = []) =>
  query<T>("authenticated", DEMO_CLEANER, sql, args);
const publicQuery = <T>(sql: string, args: unknown[] = []) =>
  query<T>("anon", "", sql, args);
const service = <T>(sql: string, args: unknown[] = []) =>
  query<T>("service_role", "", sql, args);
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await initialiseDatabase(db, true);
  await db.exec(
    `create schema storage; create table storage.buckets(id text primary key,name text,public boolean); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated; grant select on storage.objects to anon; grant all on storage.objects to authenticated;`,
  );
  await db.exec(
    await fs.readFile("supabase/migrations/202610020002_storage.sql", "utf8"),
  );
  await db.exec(
    "insert into storage.objects(bucket_id,name) values('website-media','sample-image.png'),('call-recordings','private-sample.mp3')",
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("database permissions", () => {
  it("separates public media from private recordings and denies cleaner uploads", async () => {
    expect(
      await publicQuery<{ name: string }>("select name from storage.objects"),
    ).toEqual([{ name: "sample-image.png" }]);
    expect(
      await cleaner<{ name: string }>("select name from storage.objects"),
    ).toEqual([{ name: "sample-image.png" }]);
    expect(await admin("select * from storage.objects")).toHaveLength(2);
    await expect(
      cleaner(
        "insert into storage.objects(bucket_id,name) values('website-media','attack.png')",
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("public visitors cannot read customer data or submit directly", async () => {
    await expect(publicQuery("select * from customers")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      publicQuery("select submit_enquiry('{}','test')"),
    ).rejects.toThrow(/permission denied/);
  });
  it("cleaners cannot access internal records or grant themselves admin", async () => {
    expect(await cleaner("select * from customers")).toEqual([]);
    expect(await cleaner("select * from conversations")).toEqual([]);
    await expect(
      cleaner("update profiles set role='admin' where id=$1", [DEMO_CLEANER]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      cleaner('select save_customer(\'{"name":"Attack"}\')'),
    ).rejects.toThrow(/Admin access/);
  });
  it("assigned jobs expose the needed fields without CRM notes", async () => {
    const jobs = await cleaner<Record<string, unknown>>(
      "select * from cleaner_jobs()",
    );
    expect(jobs.length).toBe(1);
    expect(jobs[0].address).toContain("synthetic");
    expect(jobs[0]).not.toHaveProperty("internal_notes");
    expect(jobs[0]).not.toHaveProperty("email");
    expect(
      await query(
        "authenticated",
        DEMO_SECOND_CLEANER,
        "select * from cleaner_jobs()",
      ),
    ).toEqual([]);
  });
  it("cleaners cannot edit the rota and only transition their own job in order", async () => {
    const [originalJob] = await cleaner<{ id: string }>(
      "select * from cleaner_jobs()",
    );
    for (const change of [
      { id: originalJob.id, starts_at: "2031-01-06T09:00:00Z" },
      { id: originalJob.id, status: "cancelled" },
    ]) {
      await expect(
        cleaner("select change_visit($1)", [JSON.stringify(change)]),
      ).rejects.toThrow(/Admin access/);
    }
    await expect(
      cleaner(
        "update visits set starts_at=starts_at + interval '1 hour' where id=$1",
        [originalJob.id],
      ),
    ).rejects.toThrow(/permission denied/);
    expect(await cleaner("select * from cleaner_jobs()")).toContainEqual(
      originalJob,
    );
    const [{ id }] = await cleaner<{ id: string }>(
      "select id from cleaner_jobs()",
    );
    await expect(
      query(
        "authenticated",
        DEMO_SECOND_CLEANER,
        "select transition_visit($1,'started')",
        [id],
      ),
    ).rejects.toThrow(/not allowed/);
    await expect(
      cleaner("select transition_visit($1,'completed')", [id]),
    ).rejects.toThrow(/not allowed/);
    await cleaner("select transition_visit($1,'started')", [id]);
    await cleaner("select transition_visit($1,'completed')", [id]);
    expect(
      (
        await cleaner<{ status: string }>("select status from cleaner_jobs()")
      )[0].status,
    ).toBe("completed");
  });
});
describe("persistent enquiries and publishing", () => {
  it("stores a validated server submission and throttles repeated attempts", async () => {
    const p = {
      name: "Test Enquiry",
      email: "enquiry@example.test",
      phone: "+447700900555",
      postcode: "ME14 1AA",
      frequency: "weekly",
      home_size: "2 bedrooms",
      preferred_days: ["Monday"],
      notes: "Test",
    };
    await service("select submit_enquiry($1,$2)", [
      JSON.stringify(p),
      "test-rate",
    ]);
    expect((await admin("select * from enquiries")).length).toBe(1);
    for (let i = 0; i < 4; i++)
      await service("select submit_enquiry($1,$2)", [
        JSON.stringify(p),
        "test-rate",
      ]);
    await expect(
      service("select submit_enquiry($1,$2)", [JSON.stringify(p), "test-rate"]),
    ).rejects.toThrow(/wait before/);
  });
  it("drafts are hidden, publishing exposes content, unpublishing removes it", async () => {
    const p = {
      kind: "blog",
      slug: "test-article",
      title: "A test article",
      status: "draft",
      body: { type: "doc", content: [] },
    };
    const [{ id }] = await admin<{ id: string }>(
      "select save_content($1) as id",
      [JSON.stringify(p)],
    );
    expect(
      await publicQuery("select * from content where slug='test-article'"),
    ).toEqual([]);
    await admin("select save_content($1)", [
      JSON.stringify({ ...p, id, status: "published" }),
    ]);
    expect(
      (await publicQuery("select * from content where slug='test-article'"))
        .length,
    ).toBe(1);
    await admin("select save_content($1)", [JSON.stringify({ ...p, id })]);
    expect(
      await publicQuery("select * from content where slug='test-article'"),
    ).toEqual([]);
  });
});
describe("scheduling with database constraints", () => {
  it.each([
    ["2027-03-21", "2027-03-28"],
    ["2026-10-18", "2026-10-25"],
  ])("preserves 09:00 local time across DST from %s", async (date) => {
    const p = {
      customer_id: customer,
      cleaner_id: DEMO_SECOND_CLEANER,
      date,
      time: "09:00",
      customer_rate_pence: 1800,
      admin_rate_pence: 300,
      cleaner_rate_pence: 1500,
      duration_minutes: 180,
      interval_weeks: 1,
      occurrences: 2,
      instructions: "DST test",
    };
    const [{ id }] = await admin<{ id: string }>(
      "select create_booking($1) as id",
      [JSON.stringify(p)],
    );
    const visits = await admin<{ starts_at: Date }>(
      "select starts_at from visits where series_id=$1 order by starts_at",
      [id],
    );
    expect(visits.map((v) => v.starts_at.toISOString())).toEqual(
      occurrenceInstants(date, "09:00", 1, 2).map((v) =>
        new Date(v).toISOString(),
      ),
    );
    expect(
      visits.map((v) =>
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(v.starts_at),
      ),
    ).toEqual(["09", "09"]);
  });
  it("allows one competing assignment and rejects the overlapping request", async () => {
    const p = {
      customer_id: customer,
      cleaner_id: DEMO_SECOND_CLEANER,
      date: "2027-06-01",
      time: "09:00",
      customer_rate_pence: 1800,
      admin_rate_pence: 300,
      cleaner_rate_pence: 1500,
      duration_minutes: 180,
      interval_weeks: 0,
      occurrences: 1,
    };
    const results = await Promise.allSettled([
      admin("select create_booking($1)", [JSON.stringify(p)]),
      admin("select create_booking($1)", [JSON.stringify(p)]),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("rejects visits outside availability and approved leave", async () => {
    const p = {
      customer_id: customer,
      cleaner_id: DEMO_CLEANER,
      date: "2027-07-01",
      time: "06:00",
      customer_rate_pence: 1800,
      admin_rate_pence: 300,
      cleaner_rate_pence: 1500,
      duration_minutes: 180,
      interval_weeks: 0,
      occurrences: 1,
    };
    await expect(
      admin("select create_booking($1)", [JSON.stringify(p)]),
    ).rejects.toThrow(/availability/);
    const [{ id }] = await cleaner<{ id: string }>(
      "select request_leave($1) as id",
      [
        JSON.stringify({
          starts_on: "2027-07-01",
          ends_on: "2027-07-02",
          reason: "Test",
        }),
      ],
    );
    await admin("select review_request($1)", [
      JSON.stringify({ id, kind: "leave", status: "approved" }),
    ]);
    await expect(
      admin("select create_booking($1)", [
        JSON.stringify({ ...p, time: "09:00" }),
      ]),
    ).rejects.toThrow(/leave/);
  });
  it("cancels one occurrence without changing its series", async () => {
    const p = {
      customer_id: customer,
      cleaner_id: DEMO_CLEANER,
      date: "2027-08-01",
      time: "09:00",
      customer_rate_pence: 1800,
      admin_rate_pence: 300,
      cleaner_rate_pence: 1500,
      duration_minutes: 180,
      interval_weeks: 2,
      occurrences: 3,
    };
    const [{ id }] = await admin<{ id: string }>(
      "select create_booking($1) as id",
      [JSON.stringify(p)],
    );
    const visits = await admin<{ id: string }>(
      "select id from visits where series_id=$1 order by starts_at",
      [id],
    );
    await admin("select change_visit($1)", [
      JSON.stringify({ id: visits[1].id, status: "cancelled" }),
    ]);
    expect(
      (
        await admin<{ status: string }>(
          "select status from visits where series_id=$1 order by starts_at",
          [id],
        )
      ).map((v) => v.status),
    ).toEqual(["scheduled", "cancelled", "scheduled"]);
  });
  it("will not approve leave which conflicts with assigned work", async () => {
    const [{ id }] = await cleaner<{ id: string }>(
      "select request_leave($1) as id",
      [JSON.stringify({ starts_on: "2027-08-01", ends_on: "2027-08-01" })],
    );
    await expect(
      admin("select review_request($1)", [
        JSON.stringify({ id, kind: "leave", status: "approved" }),
      ]),
    ).rejects.toThrow(/Reschedule/);
  });
});
describe("provider event persistence", () => {
  it("deduplicates retries, correlates legs and does not regress terminal status", async () => {
    const p = {
      provider: "test",
      root_call_id: "root",
      call_leg_id: "child",
      caller: "+447700900123",
      status: "completed",
      event_key: "end",
      duration_seconds: 120,
    };
    const [{ id }] = await service<{ id: string }>(
      "select ingest_call_event($1) as id",
      [JSON.stringify(p)],
    );
    await service("select ingest_call_event($1)", [JSON.stringify(p)]);
    await service("select ingest_call_event($1)", [
      JSON.stringify({
        ...p,
        status: "ringing",
        event_key: "early",
        call_leg_id: "root",
        duration_seconds: 0,
      }),
    ]);
    const calls = await admin<{
      status: string;
      duration_seconds: number;
      suggested_customer_id: string;
    }>("select * from conversations where id=$1", [id]);
    expect(calls[0].status).toBe("completed");
    expect(calls[0].duration_seconds).toBe(120);
    expect(calls[0].suggested_customer_id).toBe(customer);
    expect(
      await admin("select * from call_events where conversation_id=$1", [id]),
    ).toHaveLength(2);
    await service("select set_transcript($1)", [
      JSON.stringify({
        conversation_id: id,
        status: "failed",
        error_code: "NO_AUDIO",
      }),
    ]);
    expect(
      (
        await admin<{ transcript_status: string; recording_status: string }>(
          "select * from conversations where id=$1",
          [id],
        )
      )[0],
    ).toMatchObject({
      transcript_status: "failed",
      recording_status: "disabled",
    });
  });
});

describe("durable transcription and late inbound events", () => {
  it("retries transcript stages without duplicates or completed-state regression", async () => {
    const p = {
      provider: "durable-test",
      root_call_id: "root-durable",
      call_leg_id: "child-durable",
      caller: "unknown",
      status: "completed",
      event_key: "end-durable",
    };
    const [{ id }] = await service<{ id: string }>(
      "select ingest_call_event($1) as id",
      [JSON.stringify(p)],
    );
    await service("select ingest_call_event($1)", [
      JSON.stringify({
        ...p,
        caller: "+447700900123",
        authoritative_caller: true,
        event_key: "inbound-durable",
        status: "ringing",
      }),
    ]);
    expect(
      (
        await admin<{ caller: string }>(
          "select caller from conversations where id=$1",
          [id],
        )
      )[0].caller,
    ).toBe("+447700900123");
    await service("select set_transcript($1)", [
      JSON.stringify({
        conversation_id: id,
        status: "failed",
        error_code: "NO_AUDIO",
      }),
    ]);
    await service("select set_transcript($1)", [
      JSON.stringify({
        conversation_id: id,
        status: "failed",
        error_code: "NO_AUDIO",
      }),
    ]);
    expect(
      await admin("select * from transcripts where conversation_id=$1", [id]),
    ).toHaveLength(1);
    const [{ rid }] = await service<{ rid: string }>(
      "insert into recordings(conversation_id,provider_sid,expires_at) values($1,'REsynthetic',now()+interval '1 day') returning id as rid",
      [id],
    );
    await service("select enqueue_transcription($1)", [rid]);
    const jobs = await service<{ id: string }>(
      "select * from claim_transcription_jobs()",
    );
    expect(jobs).toHaveLength(1);
    expect(
      await service("select * from claim_transcription_jobs()"),
    ).toHaveLength(0);
    await service("select update_transcription_job($1)", [
      JSON.stringify({
        id: jobs[0].id,
        provider_job_id: "synthetic-job",
        status: "completed",
        text: "Synthetic completed transcript.",
      }),
    ]);
    await service("select update_transcription_job($1)", [
      JSON.stringify({
        id: jobs[0].id,
        provider_job_id: "synthetic-job",
        status: "failed",
        error_code: "LATE_ERROR",
      }),
    ]);
    expect(
      (
        await admin<{ transcript_status: string }>(
          "select transcript_status from conversations where id=$1",
          [id],
        )
      )[0].transcript_status,
    ).toBe("completed");
    await expect(
      cleaner("select * from claim_transcription_jobs()"),
    ).rejects.toThrow(/permission denied/);
  });
  it.each(["2027-03-28", "2026-10-25"])(
    "rejects skipped or ambiguous local times on %s",
    async (date) => {
      const p = {
        customer_id: customer,
        cleaner_id: DEMO_CLEANER,
        date,
        time: "01:30",
        customer_rate_pence: 1800,
        admin_rate_pence: 300,
        cleaner_rate_pence: 1500,
        duration_minutes: 180,
        interval_weeks: 0,
        occurrences: 1,
      };
      await expect(
        admin("select create_booking($1)", [JSON.stringify(p)]),
      ).rejects.toThrow(/clock change/);
    },
  );
});

describe("admin-managed weekly availability", () => {
  const hours = [
    { weekday: 1, start_time: "08:00", end_time: "12:00" },
    { weekday: 1, start_time: "13:00", end_time: "17:00" },
    { weekday: 6, start_time: "10:00", end_time: "14:00" },
  ];
  let counter = 0;
  async function profile() {
    const id = `aaaaaaaa-aaaa-4aaa-8aaa-${String(++counter).padStart(12, "0")}`;
    await db.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,'{}')",
      [id],
    );
    return id;
  }
  async function registered() {
    const id = await profile();
    await admin("select register_cleaner($1)", [
      JSON.stringify({ id, name: "Test Weekly Cleaner", availability: hours }),
    ]);
    return id;
  }
  const readHours = (id: string) =>
    admin<{ weekday: number; start_time: string; end_time: string }>(
      "select weekday,to_char(start_time,'HH24:MI') as start_time,to_char(end_time,'HH24:MI') as end_time from availability where cleaner_id=$1 order by weekday,start_time",
      [id],
    );
  it("creates exactly the chosen days and split periods, preserving them on restart", async () => {
    const id = await registered();
    expect(await readHours(id)).toEqual(hours);
    await initialiseDatabase(db, true);
    expect(await readHours(id)).toEqual(hours);
    expect(
      await cleaner<{ cleaner_id: string }>(
        "select cleaner_id from availability",
      ),
    ).not.toContainEqual({ cleaner_id: id });
  });
  it("denies direct and RPC changes by cleaners or public callers", async () => {
    const id = await registered();
    const p = JSON.stringify({ cleaner_id: id, availability: hours });
    await expect(
      cleaner("select save_cleaner_availability($1)", [p]),
    ).rejects.toThrow(/Admin access/);
    await expect(
      publicQuery("select save_cleaner_availability($1)", [p]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      cleaner("delete from availability where cleaner_id=$1", [DEMO_CLEANER]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      cleaner("select register_cleaner($1)", [
        JSON.stringify({
          id: await profile(),
          name: "Denied Cleaner",
          availability: hours,
        }),
      ]),
    ).rejects.toThrow(/Admin access/);
    expect(await readHours(id)).toEqual(hours);
  });
  it("rolls back profile registration when hours are missing or overlap", async () => {
    for (const availability of [
      [],
      [...hours, { weekday: 1, start_time: "11:00", end_time: "14:00" }],
    ]) {
      const id = await profile();
      await expect(
        admin("select register_cleaner($1)", [
          JSON.stringify({ id, name: "Invalid Cleaner", availability }),
        ]),
      ).rejects.toThrow(/working day|overlap/);
      expect(await admin("select id from cleaners where id=$1", [id])).toEqual(
        [],
      );
      expect(await readHours(id)).toEqual([]);
    }
  });
  it("protects upcoming assignments, rolls back rejected hours, and refreshes/audits accepted changes", async () => {
    const id = await registered();
    const booking = {
      customer_id: customer,
      cleaner_id: id,
      date: "2030-01-07",
      time: "09:00",
      customer_rate_pence: 1800,
      admin_rate_pence: 300,
      cleaner_rate_pence: 1500,
      duration_minutes: 120,
      interval_weeks: 0,
      occurrences: 1,
    };
    const [{ visitId }] = await admin<{ visitId: string }>(
      'select create_booking($1) as "visitId"',
      [JSON.stringify(booking)],
    );
    const before = await admin(
      "select availability_updated_at from cleaners where id=$1",
      [id],
    );
    await expect(
      admin("select save_cleaner_availability($1)", [
        JSON.stringify({
          cleaner_id: id,
          availability: [
            { weekday: 1, start_time: "12:00", end_time: "17:00" },
          ],
        }),
      ]),
    ).rejects.toThrow(/Move conflicting upcoming visits/);
    expect(await readHours(id)).toEqual(hours);
    expect(
      await admin("select availability_updated_at from cleaners where id=$1", [
        id,
      ]),
    ).toEqual(before);
    await admin("select change_visit($1)", [
      JSON.stringify({ id: visitId, status: "cancelled" }),
    ]);
    await admin("select save_cleaner_availability($1)", [
      JSON.stringify({ cleaner_id: id, availability: [] }),
    ]);
    expect(await readHours(id)).toEqual([]);
    expect(
      await admin("select availability_updated_at from cleaners where id=$1", [
        id,
      ]),
    ).not.toEqual(before);
    expect(
      (
        await admin(
          "select id from audit_records where entity='availability' and actor_id=$1",
          [DEMO_ADMIN],
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it("merges adjacent hours so a booking can span their common boundary", async () => {
    const id = await registered();
    const availability = [
      { weekday: 1, start_time: "08:00", end_time: "12:00" },
      { weekday: 1, start_time: "12:00", end_time: "17:00" },
    ];
    await admin("select save_cleaner_availability($1)", [
      JSON.stringify({ cleaner_id: id, availability }),
    ]);
    expect(await readHours(id)).toEqual([
      { weekday: 1, start_time: "08:00", end_time: "17:00" },
    ]);
    await admin("select create_booking($1)", [
      JSON.stringify({
        customer_id: customer,
        cleaner_id: id,
        date: "2030-01-07",
        time: "11:00",
        customer_rate_pence: 1800,
        admin_rate_pence: 300,
        cleaner_rate_pence: 1500,
        duration_minutes: 120,
        interval_weeks: 0,
        occurrences: 1,
      }),
    ]);
    await expect(
      admin("select create_booking($1)", [
        JSON.stringify({
          customer_id: customer,
          cleaner_id: id,
          date: "2030-01-08",
          time: "09:00",
          customer_rate_pence: 1800,
          admin_rate_pence: 300,
          cleaner_rate_pence: 1500,
          duration_minutes: 120,
          interval_weeks: 0,
          occurrences: 1,
        }),
      ]),
    ).rejects.toThrow(/availability/);
  });
});

describe("52-week recurring bookings", () => {
  let count = 0;
  async function seriesCleaner() {
    const id = `bbbbbbbb-bbbb-4bbb-8bbb-${String(++count).padStart(12, "0")}`;
    await db.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,'{}')",
      [id],
    );
    await admin("select register_cleaner($1)", [
      JSON.stringify({
        id,
        name: "Recurring Test Cleaner",
        availability: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          start_time: "08:00",
          end_time: "20:00",
        })),
      }),
    ]);
    return id;
  }
  const base = (cleaner_id: string) => ({
    customer_id: customer,
    cleaner_id,
    date: "2032-01-05",
    time: "09:00",
    customer_rate_pence: 1800,
    admin_rate_pence: 300,
    cleaner_rate_pence: 1500,
    duration_minutes: 180,
    interval_weeks: 1,
    occurrences: 52,
    duration_weeks: 52,
  });
  it.each([
    { interval_weeks: 1, occurrences: 52 },
    { interval_weeks: 2, occurrences: 26 },
  ])(
    "creates a full-year period at frequency $interval_weeks",
    async (recurrence) => {
      const cleaner_id = await seriesCleaner();
      const [{ id }] = await admin<{ id: string }>(
        "select create_booking($1) as id",
        [JSON.stringify({ ...base(cleaner_id), ...recurrence })],
      );
      const [series] = await admin<{ duration_weeks: number; ends_on: string }>(
        "select duration_weeks,ends_on::text from booking_series where id=$1",
        [id],
      );
      expect(series).toEqual({ duration_weeks: 52, ends_on: "2033-01-02" });
      const visits = await admin<{ local_date: string; local_time: string }>(
        "select (starts_at at time zone 'Europe/London')::date::text as local_date,to_char(starts_at at time zone 'Europe/London','HH24:MI') as local_time from visits where series_id=$1 order by starts_at",
        [id],
      );
      expect(visits).toHaveLength(recurrence.occurrences);
      expect(visits.every((v) => v.local_time === "09:00")).toBe(true);
      expect(visits.at(-1)?.local_date).toBe(
        recurrence.interval_weeks === 1 ? "2032-12-27" : "2032-12-20",
      );
      expect(
        await cleaner("select * from booking_series where id=$1", [id]),
      ).toEqual([]);
      await expect(
        publicQuery("select * from booking_series where id=$1", [id]),
      ).rejects.toThrow(/permission denied/);
    },
  );
  it("rejects oversized or mismatched periods without creating any series or visits", async () => {
    const cleaner_id = await seriesCleaner();
    for (const patch of [
      { duration_weeks: 53, occurrences: 53 },
      { interval_weeks: 2, occurrences: 27, duration_weeks: undefined },
      { interval_weeks: 2, occurrences: 52 },
      { duration_weeks: 51 },
    ]) {
      await expect(
        admin("select create_booking($1)", [
          JSON.stringify({ ...base(cleaner_id), ...patch }),
        ]),
      ).rejects.toThrow(/booking recurrence|booking period|52 weeks/);
    }
    expect(
      await admin("select id from booking_series where cleaner_id=$1", [
        cleaner_id,
      ]),
    ).toEqual([]);
    expect(
      await admin("select id from visits where cleaner_id=$1", [cleaner_id]),
    ).toEqual([]);
  });
  it("rolls back a year of visits when the final occurrence conflicts", async () => {
    const cleaner_id = await seriesCleaner();
    await admin("select create_booking($1)", [
      JSON.stringify({
        ...base(cleaner_id),
        date: "2032-12-27",
        interval_weeks: 0,
        occurrences: 1,
        duration_weeks: undefined,
      }),
    ]);
    await expect(
      admin("select create_booking($1)", [JSON.stringify(base(cleaner_id))]),
    ).rejects.toThrow(/no_cleaner_overlap/);
    expect(
      await admin("select id from booking_series where cleaner_id=$1", [
        cleaner_id,
      ]),
    ).toEqual([]);
    expect(
      await admin("select id from visits where cleaner_id=$1", [cleaner_id]),
    ).toHaveLength(1);
  });
  it("keeps the saved end date after exceptions and restart", async () => {
    const cleaner_id = await seriesCleaner();
    const [{ id }] = await admin<{ id: string }>(
      "select create_booking($1) as id",
      [
        JSON.stringify({
          ...base(cleaner_id),
          occurrences: 3,
          duration_weeks: 3,
        }),
      ],
    );
    const visits = await admin<{ id: string }>(
      "select id from visits where series_id=$1 order by starts_at",
      [id],
    );
    await admin("select change_visit($1)", [
      JSON.stringify({ id: visits.at(-1)!.id, status: "cancelled" }),
    ]);
    await admin("select change_visit($1)", [
      JSON.stringify({ id: visits[0].id, starts_at: "2032-01-06T09:00:00Z" }),
    ]);
    const saved = await admin(
      "select anchor_date::text,ends_on::text,duration_weeks from booking_series where id=$1",
      [id],
    );
    expect(saved).toEqual([
      { anchor_date: "2032-01-05", ends_on: "2032-01-25", duration_weeks: 3 },
    ]);
    await initialiseDatabase(db, true);
    expect(
      await admin(
        "select anchor_date::text,ends_on::text,duration_weeks from booking_series where id=$1",
        [id],
      ),
    ).toEqual(saved);
  });
});

it("upgrades legacy recurring terms without changing visits or losing cancelled occurrences", async () => {
  const legacy = new PGlite({ extensions: { btree_gist } });
  try {
    await legacy.exec(localBootstrap);
    await legacy.exec(
      await fs.readFile(
        "supabase/migrations/202610020001_foundation.sql",
        "utf8",
      ),
    );
    await legacy.exec(`insert into auth.users(id,raw_user_meta_data) values('${DEMO_ADMIN}','{}'),('${DEMO_CLEANER}','{}');
      update profiles set role='admin' where id='${DEMO_ADMIN}';
      insert into cleaners(id,name) values('${DEMO_CLEANER}','Legacy Test Cleaner');
      insert into availability(cleaner_id,weekday,start_time,end_time) select '${DEMO_CLEANER}',d,'08:00','20:00' from generate_series(0,6) d;
      insert into customers(id,name,address,postcode) values('${customer}','Legacy Test Customer','Synthetic example','ME14 1AA');`);
    const id = await legacy.transaction(async (tx) => {
      await tx.exec("set local role authenticated");
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
        DEMO_ADMIN,
      ]);
      return (
        await tx.query<{ id: string }>("select create_booking($1) as id", [
          JSON.stringify({
            customer_id: customer,
            cleaner_id: DEMO_CLEANER,
            date: "2032-01-05",
            time: "09:00",
            customer_rate_pence: 1800,
            admin_rate_pence: 300,
            cleaner_rate_pence: 1500,
            duration_minutes: 180,
            interval_weeks: 2,
            occurrences: 26,
          }),
        ])
      ).rows[0].id;
    });
    await legacy.query(
      "update visits set status='cancelled' where id=(select id from visits where series_id=$1 order by starts_at desc limit 1)",
      [id],
    );
    const before = (
      await legacy.query(
        "select * from visits where series_id=$1 order by starts_at",
        [id],
      )
    ).rows;
    await initialiseDatabase(legacy, false);
    expect(
      (
        await legacy.query(
          "select duration_weeks,anchor_date::text,ends_on::text from booking_series where id=$1",
          [id],
        )
      ).rows,
    ).toEqual([
      { duration_weeks: 52, anchor_date: "2032-01-05", ends_on: "2033-01-02" },
    ]);
    expect(
      (
        await legacy.query(
          "select * from visits where series_id=$1 order by starts_at",
          [id],
        )
      ).rows,
    ).toEqual(before);
    await initialiseDatabase(legacy, false);
    expect(
      (
        await legacy.query(
          "select duration_weeks,ends_on::text from booking_series where id=$1",
          [id],
        )
      ).rows,
    ).toEqual([{ duration_weeks: 52, ends_on: "2033-01-02" }]);
  } finally {
    await legacy.close();
  }
}, 30000);
