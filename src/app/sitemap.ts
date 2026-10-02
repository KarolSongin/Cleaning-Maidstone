import type { MetadataRoute } from "next";
import { publishedContent } from "@/lib/repository";
import { business } from "@/lib/business";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const path of [
    "/",
    "/maidstone-domestic-cleaning/",
    "/about-us/",
    "/contact-us/",
    "/pricing/",
    "/privacy/",
    "/blog/",
  ])
    paths.set(path, { url: business.url + path });
  for (const c of await publishedContent()) {
    const path =
      c.kind === "blog"
        ? "/blog/" + c.slug + "/"
        : c.slug === "home"
          ? "/"
          : "/" + c.slug + "/";
    paths.set(path, { url: business.url + path, lastModified: c.updated_at });
  }
  return [...paths.values()];
}
