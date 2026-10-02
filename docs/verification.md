# Verification — 2 October 2026

Verified in this cloud checkout with Node 24.19.0, npm 11.9.0, Next.js 16.3.8 and system Chromium. The functional checks cover the homepage with its room explorer removed, matching photo heroes across public pages and the read-only cleaner calendar. The performance benchmark below belongs to the preceding public redesign. No existing domain, production data or phone routing was changed.

| Check                                                      | Result                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Frozen dependency installation / saved installation script | Passed `npm ci` followed by the production build                                                           |
| `npm run lint`                                             | Passed                                                                                                     |
| `npm run typecheck`                                        | Passed; the final production build also passed TypeScript checks                                           |
| `npm run test`                                             | 21 tests passed                                                                                            |
| `npm run test:e2e`                                         | 18 journeys passed: nine each on desktop and mobile                                                        |
| `npm run build`                                            | Passed; server-rendered public routes and operational/API routes compiled                                  |
| Production startup                                         | Homepage, pricing, robots and sitemap return HTTP 200; anonymous admin access redirects to login           |
| Deployment file tracing                                    | All 33 generated trace manifests checked; no `.local/` data, `.env` files or browser-test results included |

The focused tests run actual PostgreSQL policies and transactional operations in PGlite. They cover anonymous/cleaner restrictions, own-job projections, denied role changes, storage policies, enquiry persistence/throttling, publishing, denied cleaner rescheduling/cancellation of their own appointments, London DST transitions, invalid local clock times, concurrent overlaps, availability/leave conflicts and individual-occurrence changes. Phone tests cover signature validation, altered payloads/URLs, duplicate and out-of-order events, forwarded-leg correlation, transcript-stage deduplication and durable job claims.

Browser journeys cover initial rendered content/metadata, preserved contact redirect, 404s, mobile overflow, keyboard navigation, enquiry validation/persistence, customer editing, competing assignments, admin calendar navigation, read-only cleaner day/week/month views and event keyboard focus, direct API/recording restrictions, same-origin checks, authenticated previews, article and homepage publishing/unpublishing, initial-head SEO metadata, duplicate sample calls, failed transcription, hero links to content/form sections, long article titles and a single published feature image. Each run uses a fresh synthetic database; the normal demo database is preserved.

Production browser checks visited the homepage, Services, About, Prices, Contact, Journal, an article and Privacy at desktop and mobile widths. Every route returned HTTP 200, with loaded hero images, no visible breadcrumb headers, no room explorer, no horizontal overflow and no browser runtime errors. The removed explorer’s browser journey was retired; its unused component files remain for a future 3D decision.

## Measured mobile performance

This benchmark was captured for commit `137de36`, before the room explorer was removed and the shared page heroes added. Lighthouse 13.5.0 measured that production homepage at 21:23 UTC using its mobile simulated throttling (4× CPU slowdown, 150 ms RTT, approximately 1.6 Mbps throughput). This is a local laboratory measurement, not deployed-site or field data. It was the first audited navigation after restarting the production server, with a persistent synthetic database, an existing server image cache and a cold browser cache. No Lighthouse runtime errors or warnings were reported.

| Metric                               | Target             | Measured                                 |
| ------------------------------------ | ------------------ | ---------------------------------------- |
| Performance score                    | At least 90        | **92**                                   |
| Accessibility / Best Practices / SEO | —                  | **100 / 100 / 100**                      |
| Largest Contentful Paint             | At or below 2.5 s  | **3.304 s**, above the target            |
| Cumulative Layout Shift              | At or below 0.1    | **0.000574**                             |
| First Contentful Paint               | —                  | **1.380 s**                              |
| Total Blocking Time                  | —                  | **47 ms**                                |
| Interaction to Next Paint            | At or below 200 ms | Not measured; field INP needs real usage |

The performance-score and layout-shift targets passed; the 2.5-second LCP target remains unmet in this cold-start local measurement. The image is eagerly loaded at high priority with layout-aware responsive sizes. The score does not establish full accessibility conformance. Total Blocking Time is a lab diagnostic and is not a substitute for INP. The optimised public bundle keeps calendar, editor, 3D and server-side validation dependencies out of the initial public load. The room explorer has since been removed from the homepage.

Machine-readable measured values are in [lighthouse-mobile-summary.json](lighthouse-mobile-summary.json). The full local report and homepage screenshots are retained under the ignored `.local/` directory; the browser-run screenshots are in ignored `test-results/`. Current production screenshots include `redesign-home-desktop.png`, `redesign-home-mobile.png`, `matched-services-desktop.png`, `matched-contact-desktop.png` and `cleaner-calendar-desktop.png` under `.local/`. Both viewport checks found no horizontal overflow, missing images or browser runtime errors; navigation from the public site to the cleaner portal retained dashboard styling.

## Configuration still required

The local demo is working with synthetic accounts/data and persistent embedded PostgreSQL. It is not production authentication. Supabase Auth, Storage and Realtime have not been tested against a live project; the storage policy tests use a fixture for Supabase-managed schemas. External recording/transcription processing has not occurred. Recording and transcription remain disabled.

To connect real services, supply the Supabase project configuration securely, apply all migrations, create the first trusted admin, confirm Auth redirects and test the managed service policies. Confirm the phone provider/PWMS integration and routing plan before setting Twilio callbacks. Enable recording/transcription only after supplying their settings and credentials; connect authenticated dispatch and retention schedules. See [integration requirements](integrations.md) and the [README](../README.md).

The cloud environment draft contains the tested installation script and service-start instructions. Saving an environment draft and publishing source to GitHub are separate from deployment. No deployment, domain migration, number purchase or live call was performed.
