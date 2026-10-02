import type { NextConfig } from "next";
const config: NextConfig = {
  // Keep editable SEO and sharing metadata in the initial head for every client.
  htmlLimitedBots: /.*/,
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingExcludes: {
    "/*": [
      ".local/**/*",
      ".env*",
      "test-results/**/*",
      "playwright-report/**/*",
    ],
  },
  async redirects() {
    return [
      { source: "/contact", destination: "/contact-us/", permanent: true },
      ...["/sitemap_index.xml", "/page-sitemap.xml", "/wp-sitemap.xml"].map(
        (source) => ({ source, destination: "/sitemap.xml", permanent: true }),
      ),
    ];
  },
  trailingSlash: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      ...[
        "/admin/:path*",
        "/cleaner/:path*",
        "/api/:path*",
        "/preview/:path*",
        "/login/:path*",
      ].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};
export default config;
