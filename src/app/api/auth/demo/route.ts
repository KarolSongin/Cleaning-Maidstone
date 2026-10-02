import { NextRequest, NextResponse } from "next/server";
import { demoEnabled } from "@/lib/local-db";
import { demoToken } from "@/lib/auth";
import { sameOrigin, requestOrigin } from "@/lib/http";
export async function POST(request: NextRequest) {
  if (
    !demoEnabled() ||
    !["127.0.0.1", "localhost", "[::1]"].includes(request.nextUrl.hostname)
  )
    return NextResponse.json({ error: "Local demo only" }, { status: 404 });
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const role = (await request.formData()).get("role");
  if (role !== "admin" && role !== "cleaner")
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  const response = NextResponse.redirect(
    new URL(role === "admin" ? "/admin/" : "/cleaner/", requestOrigin(request)),
    303,
  );
  response.cookies.set("maidstone-demo", await demoToken(role), {
    httpOnly: true,
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 28800,
  });
  return response;
}
