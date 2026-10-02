import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// Use the Sharp dependency supplied by the pinned Next.js installation.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp = nextRequire("sharp");
sharp.concurrency(2);

const output = path.resolve("public/images/mobile");
await mkdir(output, { recursive: true });
const widths = [384, 512, 640, 750, 828, 1080, 1200, 1440, 1600, 1920];
const photos = [
  ["living-room", 0.58],
  ["home-detail", 0.58],
  ["kitchen-detail", 0.5],
  ["bathroom-detail", 0.5],
];
for (const [name, focalX] of photos) {
  const input = path.resolve(`public/images/${name}.webp`);
  const metadata = await sharp(input).metadata();
  const side = Math.min(metadata.width, metadata.height);
  const region = {
    left: Math.round((metadata.width - side) * focalX),
    top: Math.round((metadata.height - side) / 2),
    width: side,
    height: side,
  };
  for (const width of widths) {
    const image = sharp(input)
      .extract(region)
      .resize({ width, withoutEnlargement: true });
    await Promise.all([
      image
        .clone()
        .avif({ quality: 80, effort: 4 })
        .toFile(path.join(output, `${name}-${width}.avif`)),
      image
        .clone()
        .webp({ quality: 90, effort: 6, smartSubsample: true })
        .toFile(path.join(output, `${name}-${width}.webp`)),
    ]);
  }
  console.log(`Generated mobile AVIF and WebP sizes for ${name}.`);
}
