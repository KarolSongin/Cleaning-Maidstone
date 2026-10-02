import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import {
  initialiseDatabase,
  DEMO_ADMIN,
  DEMO_CLEANER,
  DEMO_SECOND_CLEANER,
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
  it("cleaners only transition their own job in order", async () => {
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
