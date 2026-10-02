import { NextRequest, NextResponse } from "next/server";
import { rpc } from "@/lib/repository";
import { demoEnabled } from "@/lib/local-db";
import {
  secureEqual,
  transcriptionConfigured,
  dispatchTranscription,
} from "@/lib/transcription";
export const maxDuration = 120;
export async function POST(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    !secureEqual(
      request.headers.get("authorization") || "",
      "Bearer " + process.env.CRON_SECRET,
    )
  )
    return NextResponse.json({ error: "Job access denied" }, { status: 403 });
  if (demoEnabled() || !transcriptionConfigured())
    return NextResponse.json(
      { error: "Transcription is disabled or unconfigured" },
      { status: 503 },
    );
  const jobs = await rpc<
    { id: string; provider_sid: string; private_path: string | null }[]
  >("claim_transcription_jobs", {}, "service_role");
  for (const job of jobs) {
    try {
      const id = await dispatchTranscription(job);
      await rpc(
        "update_transcription_job",
        { p: { id: job.id, provider_job_id: id, status: "processing" } },
        "service_role",
      );
    } catch {
      await rpc(
        "update_transcription_job",
        { p: { id: job.id, status: "failed", error_code: "DISPATCH_FAILED" } },
        "service_role",
      );
    }
  }
  return NextResponse.json({ processed: jobs.length });
}
