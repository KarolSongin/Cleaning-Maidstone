import "server-only";
import { unstable_cache } from "next/cache";
import { localQuery, demoEnabled } from "./local-db";
import {
  sessionClient,
  serviceClient,
  publicClient,
  supabaseConfigured,
} from "./supabase";
import type { Database, Json } from "./database.types";
import type {
  Actor,
  Content,
  DashboardData,
  CleanerJob,
  RequestRecord,
} from "./models";
import type { Operation } from "./validation";
type Table = keyof Database["public"]["Tables"];
type Fn = keyof Database["public"]["Functions"];
export async function rows<T>(
  table: Table,
  actor: Actor | "anon" | "service_role",
): Promise<T[]> {
  if (demoEnabled())
    return JSON.parse(
      JSON.stringify(
        await localQuery<T>(actor, `select * from public.${table}`),
      ),
    );
  const client =
    actor === "anon"
      ? publicClient()
      : actor === "service_role"
        ? serviceClient()
        : await sessionClient();
  const { data, error } = await client.from(table).select("*");
  if (error) throw new Error(error.message);
  return data as unknown as T[];
}
export async function rpc<T>(
  name: Fn,
  args: Record<string, unknown>,
  actor: Actor | "service_role",
): Promise<T> {
  if (demoEnabled()) {
    const entries = Object.entries(args);
    const placeholders = entries
      .map(([key], i) => `${key} => $${i + 1}`)
      .join(",");
    const values = entries.map(([, v]) =>
      typeof v === "object" ? JSON.stringify(v) : v,
    );
    if (name === "cleaner_jobs" || name === "claim_transcription_jobs")
      return JSON.parse(
        JSON.stringify(
          await localQuery(actor, `select * from public.${name}()`),
        ),
      ) as T;
    const result = await localQuery<{ value: T }>(
      actor,
      `select public.${name}(${placeholders}) as value`,
      values,
    );
    return result[0]?.value;
  }
  const client =
    actor === "service_role" ? serviceClient() : await sessionClient();
  const { data, error } = await client.rpc(name, args as never);
  if (error) throw new Error(error.message);
  return data as T;
}
export async function dashboard(actor: Actor): Promise<DashboardData> {
  if (actor.role !== "admin") throw new Error("Admin access required");
  const tables: Table[] = [
    "customers",
    "cleaners",
    "visits",
    "enquiries",
    "follow_up_tasks",
    "conversations",
    "content",
    "leave_requests",
    "availability_requests",
    "availability",
    "recordings",
    "transcripts",
    "conversation_notes",
  ];
  const data = await Promise.all(tables.map((t) => rows(t, actor)));
  return Object.fromEntries(
    tables.map((t, i) => [t === "follow_up_tasks" ? "tasks" : t, data[i]]),
  ) as unknown as DashboardData;
}
export async function cleanerData(actor: Actor) {
  return {
    jobs: await rpc<CleanerJob[]>("cleaner_jobs", {}, actor),
    leave: await rows<RequestRecord>("leave_requests", actor),
    availability: await rows<RequestRecord>("availability_requests", actor),
  };
}
export async function mutate(operation: Operation, actor: Actor) {
  const { action, data } = operation;
  if (["transition", "leave", "availability"].includes(action)) {
    if (actor.role !== "cleaner") throw new Error("Cleaner access required");
  } else if (actor.role !== "admin") throw new Error("Admin access required");
  switch (action) {
    case "customer":
      return rpc("save_customer", { p: data }, actor);
    case "booking":
      return rpc("create_booking", { p: data }, actor);
    case "visit":
      return rpc("change_visit", { p: data }, actor);
    case "transition":
      return rpc(
        "transition_visit",
        { vid: data.id, new_status: data.status },
        actor,
      );
    case "enquiry":
      return rpc(
        "update_enquiry",
        { eid: data.id, new_status: data.status },
        actor,
      );
    case "leave":
      return rpc("request_leave", { p: data }, actor);
    case "availability":
      return rpc("request_availability", { p: data }, actor);
    case "review":
      return rpc("review_request", { p: data }, actor);
    case "content":
      return rpc("save_content", { p: data }, actor);
    case "task":
      return rpc("save_task", { p: data }, actor);
    case "conversation":
      return rpc("annotate_conversation", { p: data }, actor);
  }
}
async function fetchPublished(): Promise<Content[]> {
  if (!demoEnabled() && !supabaseConfigured()) return [];
  if (demoEnabled())
    return (await rows<Content>("content", "anon")).filter(
      (c) => c.status === "published",
    );
  const { data, error } = await publicClient()
    .from("content")
    .select("*")
    .eq("status", "published");
  if (error) throw new Error("Published content unavailable");
  return data as unknown as Content[];
}
const cachedPublished = unstable_cache(fetchPublished, ["published-content"], {
  tags: ["public-content"],
  revalidate: 300,
});
export async function publishedContent() {
  return demoEnabled() ? fetchPublished() : cachedPublished();
}
export async function publicContent(kind: "page" | "blog", slug: string) {
  return (
    (await publishedContent()).find(
      (c) => c.kind === kind && c.slug === slug,
    ) ?? null
  );
}
export type DatabaseJson = Json;
