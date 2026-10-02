import { NextRequest, NextResponse } from "next/server";
import { twilioAdapter, voiceResponse, recordingEnabled } from "@/lib/phone";
import { rpc, rows } from "@/lib/repository";
import { demoEnabled } from "@/lib/local-db";
import { transcriptionConfigured } from "@/lib/transcription";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stage: string }> },
) {
  const { stage } = await params;
  if (!["voice", "events", "dial", "recording"].includes(stage))
    return NextResponse.json({ error: "Unknown callback" }, { status: 404 });
  const token = process.env.TWILIO_AUTH_TOKEN;
  const base = process.env.TWILIO_WEBHOOK_BASE_URL;
  if (demoEnabled() || !token || !base || !process.env.TWILIO_ACCOUNT_SID)
    return NextResponse.json(
      { error: "Live phone integration is not configured" },
      { status: 503 },
    );
  const body = await request.text();
  if (body.length > 20000)
    return NextResponse.json({ error: "Invalid callback" }, { status: 413 });
  const values = Object.fromEntries(new URLSearchParams(body));
  const provider = twilioAdapter(token);
  const url =
    base.replace(/\/$/, "") + request.nextUrl.pathname + request.nextUrl.search;
  if (
    !provider.verify(
      url,
      values,
      request.headers.get("x-twilio-signature") || "",
    ) ||
    values.AccountSid !== process.env.TWILIO_ACCOUNT_SID
  )
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  if (
    !/^CA[a-f0-9]{32}$/i.test(values.CallSid || "") ||
    (!values.From && stage === "voice")
  )
    return NextResponse.json({ error: "Invalid call event" }, { status: 400 });
  const event = provider.event(
    values,
    request.nextUrl.searchParams.get("rootCallSid") || undefined,
  );
  if (stage === "voice") {
    event.authoritative_caller = true;
    event.caller = values.From;
  }
  if (stage === "recording") {
    if (!recordingEnabled()) return new NextResponse(null, { status: 204 });
    if (
      values.RecordingStatus === "completed" &&
      /^RE[a-f0-9]{32}$/i.test(values.RecordingSid || "")
    ) {
      event.recording_sid = values.RecordingSid;
      event.retention_days = Number(process.env.CALL_RECORDING_RETENTION_DAYS);
    }
  }
  try {
    await rpc("ingest_call_event", { p: event }, "service_role");
    if (
      stage === "recording" &&
      event.recording_sid &&
      transcriptionConfigured()
    ) {
      const record = (
        await rows<{ id: string; provider_sid: string }>(
          "recordings",
          "service_role",
        )
      ).find((r) => r.provider_sid === event.recording_sid);
      if (record)
        await rpc("enqueue_transcription", { rid: record.id }, "service_role");
    }
  } catch {
    return NextResponse.json(
      { error: "Event storage unavailable; retry callback" },
      { status: 503 },
    );
  }
  return stage === "voice"
    ? new NextResponse(voiceResponse(values.CallSid), {
        headers: { "Content-Type": "text/xml" },
      })
    : new NextResponse(null, { status: 204 });
}
