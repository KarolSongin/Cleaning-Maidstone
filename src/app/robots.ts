import type { MetadataRoute } from "next";
import { business } from "@/lib/business";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/cleaner/",
        "/login/",
        "/preview/",
        "/api/",
        "/auth/",
      ],
    },
    sitemap: business.url + "/sitemap.xml",
  };
}
