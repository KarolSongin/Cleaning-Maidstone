import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { demoEnabled, DEMO_ADMIN, DEMO_CLEANER, getLocalDb } from "./local-db";
import { sessionClient, supabaseConfigured } from "./supabase";
import type { Actor, Role } from "./models";
async function demoKey() {
  const dir = path.join(process.cwd(), ".local");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "session.key");
  try {
    return await fs.readFile(file);
  } catch {
    const key = randomBytes(32);
    try {
      await fs.writeFile(file, key, { flag: "wx", mode: 0o600 });
      return key;
    } catch {
      return fs.readFile(file);
    }
  }
}
export async function demoToken(role: Role) {
  const payload = Buffer.from(
    JSON.stringify({ role, expires: Date.now() + 8 * 3600000 }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", await demoKey())
      .update(payload)
      .digest("base64url")
  );
}
export async function verifyDemoToken(token: string): Promise<Role | null> {
  try {
    const [payload, signature] = token.split(".");
    const expected = createHmac("sha256", await demoKey())
      .update(payload)
      .digest();
    const got = Buffer.from(signature, "base64url");
    if (got.length !== expected.length || !timingSafeEqual(got, expected))
      return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return value.expires > Date.now() &&
      ["admin", "cleaner"].includes(value.role)
      ? value.role
      : null;
  } catch {
    return null;
  }
}
export async function getActor(): Promise<Actor | null> {
  if (demoEnabled()) {
    const token = (await cookies()).get("maidstone-demo")?.value;
    const role = token ? await verifyDemoToken(token) : null;
    if (!role) return null;
    await getLocalDb();
    return {
      id: role === "admin" ? DEMO_ADMIN : DEMO_CLEANER,
      role,
      name: role === "admin" ? "Alex" : "Jamie",
      demo: true,
    };
  }
  if (!supabaseConfigured()) return null;
  const client = await sessionClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  const { data } = await client
    .from("profiles")
    .select("id,display_name,role")
    .eq("id", user.id)
    .single();
  if (!data || !["admin", "cleaner"].includes(data.role)) return null;
  return {
    id: data.id,
    name: data.display_name,
    role: data.role as Role,
    demo: false,
  };
}
export async function requireActor(role?: Role) {
  const actor = await getActor();
  if (!actor) redirect("/login/");
  if (role && actor.role !== role)
    redirect(actor.role === "admin" ? "/admin/" : "/cleaner/");
  return actor;
}
