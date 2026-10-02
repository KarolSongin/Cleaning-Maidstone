import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { rows, rpc } from "@/lib/repository";
import { serviceClient } from "@/lib/supabase";
import { sameOrigin, failure } from "@/lib/http";
import twilio from "twilio";
import { deleteExternalTranscript } from "@/lib/transcription";
type Recording = {
  id: string;
  provider_sid: string;
  private_path: string | null;
  expires_at: string;
};
async function authorised(id: string) {
  const actor = await getActor();
  if (actor?.role !== "admin") return null;
  const recording = (await rows<Recording>("recordings", actor)).find(
    (r) => r.id === id,
  );
  return recording ? { actor, recording } : null;
}
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorised((await params).id);
  if (!access)
    return NextResponse.json(
      { error: "Recording access denied" },
      { status: 403 },
    );
  const { recording } = access;
  if (new Date(recording.expires_at) < new Date())
    return NextResponse.json(
      { error: "Recording retention has expired" },
      { status: 410 },
    );
  if (recording.private_path && !access.actor.demo) {
    const { data, error } = await serviceClient()
      .storage.from("call-recordings")
      .download(recording.private_path);
    if (error || !data) return failure(new Error("Recording unavailable"), 503);
    return new NextResponse(data, {
      headers: {
        "Content-Type": data.type || "audio/mpeg",
        "Cache-Control": "private, no-store",
      },
    });
  }
  if (
    access.actor.demo ||
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !/^RE[a-f0-9]{32}$/i.test(recording.provider_sid)
  )
    return failure(new Error("Recording unavailable"), 503);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Recordings/${recording.provider_sid}.mp3`;
  const response = await fetch(url, {
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          process.env.TWILIO_ACCOUNT_SID + ":" + process.env.TWILIO_AUTH_TOKEN,
        ).toString("base64"),
    },
    cache: "no-store",
    redirect: "error",
  });
  if (!response.ok) return failure(new Error("Recording unavailable"), 503);
  return new NextResponse(response.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return failure(new Error("Invalid origin"), 403);
  const access = await authorised((await params).id);
  if (!access) return failure(new Error("Recording access denied"), 403);
  try {
    if (!access.actor.demo) {
      const jobs = await rows<{
        recording_id: string;
        provider_job_id: string | null;
      }>("transcription_jobs", access.actor);
      for (const job of jobs.filter(
        (j) => j.recording_id === access.recording.id && j.provider_job_id,
      ))
        await deleteExternalTranscript(job.provider_job_id!);
      const r = access.recording;
      if (r.private_path) {
        const { error } = await serviceClient()
          .storage.from("call-recordings")
          .remove([r.private_path]);
        if (error) throw new Error("Recording deletion failed");
      } else {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN)
          throw new Error("Provider deletion is not configured");
        await twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN,
        )
          .recordings(r.provider_sid)
          .remove();
      }
    }
    await rpc("remove_recording", { rid: access.recording.id }, access.actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error, 503);
  }
}
