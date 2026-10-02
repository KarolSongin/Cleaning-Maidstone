import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { demoEnabled } from "@/lib/local-db";
import { rpc } from "@/lib/repository";
import { sameOrigin } from "@/lib/http";
export async function POST(request: NextRequest) {
  const actor = await getActor();
  if (
    !demoEnabled() ||
    actor?.role !== "admin" ||
    !["localhost", "127.0.0.1"].includes(request.nextUrl.hostname)
  )
    return NextResponse.json(
      { error: "Local admin demo only" },
      { status: 403 },
    );
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const root = "LOCAL-SAMPLE-CALL-001";
  const base = {
    provider: "sample",
    root_call_id: root,
    call_leg_id: root + "-forwarded",
    caller: "+447700900123",
    direction: "inbound",
    occurred_at: new Date().toISOString(),
  };
  const id = await rpc<string>(
    "ingest_call_event",
    {
      p: {
        ...base,
        event_key: root + "-completed",
        status: "completed",
        duration_seconds: 147,
        recording_status: "unavailable",
      },
    },
    "service_role",
  );
  await rpc(
    "ingest_call_event",
    {
      p: {
        ...base,
        event_key: root + "-ringing",
        status: "ringing",
        duration_seconds: 0,
      },
    },
    "service_role",
  );
  await rpc(
    "ingest_call_event",
    {
      p: {
        ...base,
        event_key: root + "-completed",
        status: "completed",
        duration_seconds: 147,
      },
    },
    "service_role",
  );
  await rpc(
    "set_transcript",
    {
      p: {
        conversation_id: id,
        status: "failed",
        error_code: "LOCAL_SAMPLE_NO_AUDIO",
      },
    },
    "service_role",
  );
  return NextResponse.json({ ok: true, id, sample: true });
}
