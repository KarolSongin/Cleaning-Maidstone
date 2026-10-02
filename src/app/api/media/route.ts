import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { sessionClient } from "@/lib/supabase";
import { sameOrigin, failure } from "@/lib/http";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return failure(new Error("Invalid origin"), 403);
  const actor = await getActor();
  if (actor?.role !== "admin")
    return failure(new Error("Admin access required"), 403);
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size > 4000000)
    return failure(new Error("Choose an image under 4 MB"));
  const data = Buffer.from(await file.arrayBuffer());
  const kind = data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    ? "jpg"
    : data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "png"
      : data.toString("ascii", 0, 4) === "RIFF" &&
          data.toString("ascii", 8, 12) === "WEBP"
        ? "webp"
        : null;
  if (!kind) return failure(new Error("Use a PNG, JPEG or WebP image"));
  const name = randomUUID() + "." + kind;
  if (actor.demo) {
    const dir = path.join(process.cwd(), ".local/media");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), data, { flag: "wx" });
    return NextResponse.json({ url: "/api/media/" + name + "/" });
  }
  const client = await sessionClient();
  const { error } = await client.storage
    .from("website-media")
    .upload(name, data, {
      contentType: "image/" + (kind === "jpg" ? "jpeg" : kind),
      upsert: false,
    });
  if (error) return failure(new Error("Image upload failed"), 503);
  return NextResponse.json({
    url: client.storage.from("website-media").getPublicUrl(name).data.publicUrl,
  });
}
