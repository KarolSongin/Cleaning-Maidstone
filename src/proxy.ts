import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (
    (process.env.DEMO_MODE === "local" && !process.env.VERCEL) ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return response;
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach((v) => request.cookies.set(v.name, v.value));
          response = NextResponse.next({ request });
          values.forEach((v) =>
            response.cookies.set(v.name, v.value, v.options),
          );
        },
      },
    },
  );
  await client.auth.getClaims();
  return response;
}
export const config = {
  matcher: [
    "/admin/:path*",
    "/cleaner/:path*",
    "/api/operations/:path*",
    "/api/media/:path*",
    "/preview/:path*",
  ],
};
