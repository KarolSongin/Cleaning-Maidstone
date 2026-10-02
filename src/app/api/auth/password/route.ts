import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase";
import { sameOrigin, requestOrigin, failure } from "@/lib/http";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return failure(new Error("Invalid origin"), 403);
  const actor = await getActor();
  if (!actor) return failure(new Error("Sign in required"), 401);
  if (actor.demo)
    return failure(new Error("Synthetic accounts have no password"));
  const password = (await request.formData()).get("password");
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200
  )
    return failure(new Error("Use a password between 12 and 200 characters"));
  const { error } = await (await sessionClient()).auth.updateUser({ password });
  if (error) return failure(new Error("Password update failed"), 503);
  return NextResponse.redirect(
    new URL("/cleaner/", requestOrigin(request)),
    303,
  );
}
