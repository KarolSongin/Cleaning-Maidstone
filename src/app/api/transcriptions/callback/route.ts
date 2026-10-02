import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rpc } from "@/lib/repository";
import { demoEnabled } from "@/lib/local-db";
import {
  secureEqual,
  transcriptionConfigured,
  assemblyRequest,
} from "@/lib/transcription";
export async function POST(request: NextRequest) {
  if (demoEnabled() || !transcriptionConfigured())
    return NextResponse.json(
      { error: "Transcription is unconfigured" },
      { status: 503 },
    );
  if (
    !secureEqual(
      request.headers.get("x-transcription-token") || "",
      process.env.TRANSCRIPTION_WEBHOOK_SECRET!,
    )
  )
    return NextResponse.json(
      { error: "Invalid callback authentication" },
      { status: 403 },
    );
  const body = z
    .object({ transcript_id: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/) })
    .safeParse(await request.json());
  const job = z.uuid().safeParse(request.nextUrl.searchParams.get("job"));
  if (!body.success || !job.success)
    return NextResponse.json({ error: "Invalid callback" }, { status: 400 });
  try {
    const transcript = await assemblyRequest(
      "transcript/" + body.data.transcript_id,
    );
    if (!["completed", "error"].includes(transcript.status))
      return new NextResponse(null, { status: 204 });
    await rpc(
      "update_transcription_job",
      {
        p: {
          id: job.data,
          provider_job_id: body.data.transcript_id,
          status: transcript.status === "completed" ? "completed" : "failed",
          text:
            typeof transcript.text === "string"
              ? transcript.text.slice(0, 500000)
              : null,
          error_code:
            transcript.status === "error"
              ? "PROVIDER_TRANSCRIPTION_FAILED"
              : null,
        },
      },
      "service_role",
    );
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Callback storage unavailable; retry" },
      { status: 503 },
    );
  }
}
