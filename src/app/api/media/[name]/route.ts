import { NextResponse } from "next/server";
import { demoEnabled } from "@/lib/local-db";
import fs from "node:fs/promises";
import path from "node:path";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!demoEnabled() || !/^[-a-f0-9]{36}\.(png|jpg|webp)$/.test(name))
    return new NextResponse(null, { status: 404 });
  try {
    const data = await fs.readFile(
      path.join(process.cwd(), ".local/media", name),
    );
    return new NextResponse(data, {
      headers: {
        "Content-Type":
          "image/" + (name.endsWith("jpg") ? "jpeg" : name.split(".").pop()),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public,max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
