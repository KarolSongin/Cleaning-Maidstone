import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { dashboard, cleanerData, mutate } from "@/lib/repository";
import { operationSchema } from "@/lib/validation";
import { sameOrigin, failure } from "@/lib/http";
import { revalidatePath, revalidateTag } from "next/cache";
export async function GET() {
  const actor = await getActor();
  if (!actor)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json(
    actor.role === "admin" ? await dashboard(actor) : await cleanerData(actor),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return failure(new Error("Origin is not allowed"), 403);
  const actor = await getActor();
  if (!actor) return failure(new Error("Sign in required"), 401);
  try {
    const text = await request.text();
    if (text.length > 100000)
      return failure(new Error("Request is too large"), 413);
    const parsed = operationSchema.safeParse(JSON.parse(text));
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    const result = await mutate(parsed.data, actor);
    if (parsed.data.action === "content") {
      revalidateTag("public-content", { expire: 0 });
      revalidatePath("/", "layout");
      revalidatePath("/sitemap.xml");
    }
    return NextResponse.json(
      { ok: true, id: result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
