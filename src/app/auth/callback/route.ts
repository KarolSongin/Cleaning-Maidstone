import { NextRequest, NextResponse } from "next/server";
import { sessionClient, supabaseConfigured } from "@/lib/supabase";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code && supabaseConfigured()) {
    const { error } = await (
      await sessionClient()
    ).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/cleaner/", request.url));
  }
  return NextResponse.redirect(
    new URL("/login/?error=credentials", request.url),
  );
}
