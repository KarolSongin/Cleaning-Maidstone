import { NextRequest, NextResponse } from "next/server";
import { secureEqual } from "@/lib/transcription";
import { rpc } from "@/lib/repository";

// A scheduler can POST hourly; this job is idempotent and sends no messages.
export async function POST(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    !secureEqual(
      request.headers.get("authorization") || "",
      "Bearer " + process.env.CRON_SECRET,
    )
  )
    return NextResponse.json({ error: "Job access denied" }, { status: 403 });
  try {
    const updated = await rpc<number>(
      "run_customer_pipeline_job",
      {},
      "service_role",
    );
    return NextResponse.json(
      { updated },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Could not update the customer pipeline" },
      { status: 503 },
    );
  }
}
