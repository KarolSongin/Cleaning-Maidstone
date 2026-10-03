import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { getLocalDb } from "@/lib/local-db";
import { serviceClient } from "@/lib/supabase";
import { rpc } from "@/lib/repository";
import { sameOrigin, failure } from "@/lib/http";
import { cleanerInviteSchema } from "@/lib/validation";
import { randomUUID } from "node:crypto";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return failure(new Error("Invalid origin"), 403);
  const actor = await getActor();
  if (actor?.role !== "admin")
    return failure(new Error("Admin access required"), 403);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 12000)
      return failure(new Error("Request is too large"), 413);
    body = JSON.parse(text);
  } catch {
    return failure(new Error("Provide a valid cleaner profile"));
  }
  const parsed = cleanerInviteSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  try {
    let id: string;
    if (actor.demo) {
      id = randomUUID();
      const db = await getLocalDb();
      await db.transaction(async (tx) => {
        await tx.query(
          "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
          [id, JSON.stringify({ display_name: parsed.data.name })],
        );
        await tx.exec("set local role authenticated");
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          actor.id,
        ]);
        await tx.query("select public.register_cleaner($1)", [
          JSON.stringify({
            id,
            name: parsed.data.name,
            availability: parsed.data.availability,
          }),
        ]);
      });
    } else {
      const { data, error } =
        await serviceClient().auth.admin.inviteUserByEmail(parsed.data.email, {
          data: { display_name: parsed.data.name },
          redirectTo: new URL(
            "/auth/callback/",
            process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin,
          ).toString(),
        });
      if (error) throw new Error("The invitation could not be sent");
      id = data.user.id;
      await rpc(
        "register_cleaner",
        {
          p: {
            id,
            name: parsed.data.name,
            availability: parsed.data.availability,
          },
        },
        actor,
      );
    }
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return failure(error, 503);
  }
}
