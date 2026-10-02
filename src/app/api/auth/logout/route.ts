import { NextRequest, NextResponse } from "next/server";
import { sessionClient, supabaseConfigured } from "@/lib/supabase";
import { sameOrigin, requestOrigin } from "@/lib/http";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  if (supabaseConfigured()) await (await sessionClient()).auth.signOut();
  const response = NextResponse.redirect(
    new URL("/login/", requestOrigin(request)),
    303,
  );
  response.cookies.delete("maidstone-demo");
  return response;
}
