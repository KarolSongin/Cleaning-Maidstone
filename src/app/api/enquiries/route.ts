import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { enquirySchema } from "@/lib/validation";
import { rpc } from "@/lib/repository";
import { sameOrigin, failure } from "@/lib/http";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return failure(new Error("Origin is not allowed"), 403);
  try {
    const raw = await request.text();
    if (raw.length > 10000)
      return failure(new Error("Request is too large"), 413);
    const parsed = enquirySchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    if (parsed.data.website) return NextResponse.json({ ok: true });
    if (parsed.data.started_at && Date.now() - parsed.data.started_at < 1500)
      return failure(new Error("Please take a moment to check your details"));
    const ip = process.env.VERCEL
      ? request.headers.get("x-vercel-forwarded-for") || "unknown"
      : "local-demo";
    const key = createHash("sha256")
      .update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY || "local-demo"))
      .digest("hex");
    const id = await rpc<string>(
      "submit_enquiry",
      { p: parsed.data, throttle_key: key },
      "service_role",
    );
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return failure(error, message.includes("wait before") ? 429 : 503);
  }
}
