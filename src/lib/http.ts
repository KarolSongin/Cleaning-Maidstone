import { NextRequest, NextResponse } from "next/server";
export function requestOrigin(request: NextRequest) {
  const forwarded = process.env.VERCEL
    ? request.headers.get("x-forwarded-proto")
    : null;
  const protocol = forwarded === "https" ? "https:" : request.nextUrl.protocol;
  return protocol + "//" + request.headers.get("host");
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !!origin && origin === requestOrigin(request);
}
export function failure(error: unknown, status = 400) {
  const message =
    error instanceof Error
      ? error.message
      : "The request could not be completed";
  const safe =
    message.startsWith("Move conflicting upcoming visits") ||
    message.startsWith("Availability periods on the same day")
      ? message
      : message.includes("overlap") || message.includes("no_cleaner_overlap")
        ? "This cleaner already has a visit at that time."
        : message.includes("availability")
          ? "This time is outside the cleaner’s availability."
          : message.includes("leave")
            ? message
            : message.includes("wait before")
              ? message
              : message.includes("Admin") ||
                  message.includes("access") ||
                  message.includes("allowed")
                ? "You do not have access to this action."
                : status >= 500
                  ? "The service is temporarily unavailable. Please try again or contact us."
                  : message;
  const code =
    /Admin access required|Cleaner access required|not allowed|access denied/.test(
      message,
    )
      ? 403
      : status;
  return NextResponse.json({ error: safe }, { status: code });
}
