import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { getLocalDb } from "@/lib/local-db";
import { serviceClient } from "@/lib/supabase";
import { rpc } from "@/lib/repository";
import { sameOrigin, failure } from "@/lib/http";
import { z } from "zod";
import { randomUUID } from "node:crypto";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return failure(new Error("Invalid origin"), 403);
  const actor = await getActor();
  if (actor?.role !== "admin")
    return failure(new Error("Admin access required"), 403);
  const parsed = z
    .object({ name: z.string().trim().min(2).max(100), email: z.email() })
    .safeParse(await request.json());
  if (!parsed.success)
    return failure(new Error("Enter a name and a valid email"));
  try {
    let id: string;
    if (actor.demo) {
      id = randomUUID();
      await (
        await getLocalDb()
      ).query("insert into auth.users(id,raw_user_meta_data) values($1,$2)", [
        id,
        JSON.stringify({ display_name: parsed.data.name }),
      ]);
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
    }
    await rpc("register_cleaner", { p: { id, name: parsed.data.name } }, actor);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return failure(error, 503);
  }
}
