import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionClient, supabaseConfigured } from "@/lib/supabase";
import { getActor } from "@/lib/auth";
import { sameOrigin, requestOrigin } from "@/lib/http";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (!supabaseConfigured())
    return NextResponse.redirect(
      new URL("/login/?error=configuration", requestOrigin(request)),
      303,
    );
  const form = await request.formData();
  const parsed = z
    .object({ email: z.email(), password: z.string().min(8).max(200) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return NextResponse.redirect(
      new URL("/login/?error=credentials", requestOrigin(request)),
      303,
    );
  const client = await sessionClient();
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error)
    return NextResponse.redirect(
      new URL("/login/?error=credentials", requestOrigin(request)),
      303,
    );
  const actor = await getActor();
  return NextResponse.redirect(
    new URL(
      actor?.role === "admin" ? "/admin/" : "/cleaner/",
      requestOrigin(request),
    ),
    303,
  );
}
