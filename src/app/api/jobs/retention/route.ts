import { NextRequest, NextResponse } from "next/server";
import { secureEqual, deleteExternalTranscript } from "@/lib/transcription";
import { demoEnabled } from "@/lib/local-db";
import { rows, rpc } from "@/lib/repository";
import { serviceClient } from "@/lib/supabase";
import twilio from "twilio";
export async function POST(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    !secureEqual(
      request.headers.get("authorization") || "",
      "Bearer " + process.env.CRON_SECRET,
    )
  )
    return NextResponse.json({ error: "Job access denied" }, { status: 403 });
  if (demoEnabled())
    return NextResponse.json(
      { error: "Live retention is disabled in the demo" },
      { status: 503 },
    );
  const expired = (
    await rows<{
      id: string;
      private_path: string | null;
      provider_sid: string;
      expires_at: string;
    }>("recordings", "service_role")
  )
    .filter((r) => new Date(r.expires_at) < new Date())
    .slice(0, 25);
  let deleted = 0;
  const jobs = await rows<{
    recording_id: string;
    provider_job_id: string | null;
  }>("transcription_jobs", "service_role");
  for (const r of expired) {
    try {
      for (const job of jobs.filter(
        (j) => j.recording_id === r.id && j.provider_job_id,
      ))
        await deleteExternalTranscript(job.provider_job_id!);
      if (r.private_path) {
        const { error } = await serviceClient()
          .storage.from("call-recordings")
          .remove([r.private_path]);
        if (error) continue;
      } else {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN)
          continue;
        try {
          await twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
          )
            .recordings(r.provider_sid)
            .remove();
        } catch (e) {
          if (!(e instanceof Error && "status" in e && e.status === 404))
            continue;
        }
      }
      await rpc("purge_expired_recording", { rid: r.id }, "service_role");
      deleted++;
    } catch {
      /* Retain metadata until provider deletion succeeds; a later scheduled request retries. */
    }
  }
  return NextResponse.json({ deleted, remaining: expired.length - deleted });
}
