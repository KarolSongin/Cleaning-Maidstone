# Verification — 2–3 October 2026

Verified in this cloud checkout with Node 24.19.0, npm 11.9.0, Next.js 16.3.8 and system Chromium. The current photo-quality update passed the public-page checks below. The preceding iteration passed the full operational suite, including the read-only cleaner calendar; this update changes public images and their delivery. No existing domain, production data or phone routing was changed.

| Check                                                      | Result                                                                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Frozen dependency installation / saved installation script | Passed `npm ci` followed by the production build                                                           |
| `npm run lint`                                             | Passed                                                                                                     |
| `npm run typecheck`                                        | Passed; the final production build also passed TypeScript checks                                           |
| `npm run test`                                             | Previous iteration: 21 tests passed; backend code is unchanged in the photo update                         |
| Public browser journeys                                    | Logo update: four passed; photo update: eight passed; preceding full suite: 18 passed                      |
| Delivered photo resolution                                 | 33 images checked across 15 desktop/tablet/mobile route visits; every file meets the panel's pixel needs   |
| `npm run build`                                            | Passed; server-rendered public routes and operational/API routes compiled                                  |
| Production startup                                         | Homepage, pricing, robots and sitemap return HTTP 200; anonymous admin access redirects to login           |
| Deployment file tracing                                    | All 33 generated trace manifests checked; no `.local/` data, `.env` files or browser-test results included |

The focused tests run actual PostgreSQL policies and transactional operations in PGlite. They cover anonymous/cleaner restrictions, own-job projections, denied role changes, storage policies, enquiry persistence/throttling, publishing, denied cleaner rescheduling/cancellation of their own appointments, London DST transitions, invalid local clock times, concurrent overlaps, availability/leave conflicts and individual-occurrence changes. Phone tests cover signature validation, altered payloads/URLs, duplicate and out-of-order events, forwarded-leg correlation, transcript-stage deduplication and durable job claims.

The preceding full browser suite covers initial rendered content/metadata, preserved contact redirect, 404s, mobile overflow, keyboard navigation, enquiry validation/persistence, customer editing, competing assignments, admin calendar navigation, read-only cleaner day/week/month views and event keyboard focus, direct API/recording restrictions, same-origin checks, authenticated previews, article and homepage publishing/unpublishing, initial-head SEO metadata, duplicate sample calls, failed transcription, hero links to content/form sections, long article titles and a single published feature image. Each run uses a fresh synthetic database; the normal demo database is preserved.

For the current update, the relevant public and publishing journeys passed on desktop and mobile using `npm run test:e2e -- --grep 'public content|public service|publishing and unpublishing|homepage publishes'`. These cover the shared heroes, page links, published image rendering, SEO metadata, keyboard navigation and mobile layout.

Production browser checks visited the homepage, Services, About, Prices, Contact, Journal, an article and Privacy at desktop and mobile widths. Every route returned HTTP 200, with loaded hero images, no visible breadcrumb headers, no room explorer, no horizontal overflow and no browser runtime errors. The removed explorer’s browser journey was retired; its unused component files remain for a future 3D decision.

The photo-quality check visited the homepage, Services, About, Prices and Journal at 1,440-pixel desktop width with 2× density, 900-pixel tablet width with 2× density, and 390-pixel mobile width with 3× density. It decoded each of the 33 delivered files and compared both dimensions with the visible panel's device-pixel requirements. All files returned HTTP 200 and met those requirements, with no horizontal overflow or browser runtime errors. The previous assets delivered as little as 39.4% of the required linear resolution; the current minimum is 100%. Screenshots confirmed sharper interior detail and the new bathroom photograph.

The logo refinement was checked on 3 October: production build, lint and type checks passed, along with four desktop/mobile browser journeys using `npm run test:e2e -- --grep 'public content|public service'`. Separate header checks covered widths 320, 360, 390, 540, 760, 900, 1,100, 1,101, 1,280, 1,440 and 1,920 pixels at 3× mobile or 2× desktop density. The logo displayed at its intended larger sizes, returned HTTP 200, and matched the full-resolution original PNG byte for byte. No controls overlapped, no horizontal overflow appeared, and no browser runtime errors occurred. Screenshots and measurements are under the ignored `.local/logo-*.png` and `.local/logo-checks.json` files.

## Measured mobile performance

Lighthouse 13.5.0 measured the production homepage with the photo-quality update in commit `4507ebf` at 23:48 BST (22:48 UTC) on 2 October 2026, before the logo refinement. It used mobile simulated throttling (4× CPU slowdown, 150 ms RTT, approximately 1.6 Mbps throughput). This is a local laboratory measurement, not deployed-site or field data. It was the first audited navigation after restarting the production server, with a persistent synthetic database, an existing server image cache and a cold browser cache. The mobile crop was served directly as a pre-encoded asset. No Lighthouse runtime errors or warnings were reported. A new performance audit was not run for the small logo change.

| Metric                               | Target             | Measured                                 |
| ------------------------------------ | ------------------ | ---------------------------------------- |
| Performance score                    | At least 90        | **89**, below the target                 |
| Accessibility / Best Practices / SEO | —                  | **100 / 100 / 100**                      |
| Largest Contentful Paint             | At or below 2.5 s  | **3.724 s**, above the target            |
| Cumulative Layout Shift              | At or below 0.1    | **0.000570**                             |
| First Contentful Paint               | —                  | **1.384 s**                              |
| Total Blocking Time                  | —                  | **80.5 ms**                              |
| Interaction to Next Paint            | At or below 200 ms | Not measured; field INP needs real usage |

The layout-shift target passed; the performance-score and 2.5-second LCP targets remain unmet in this cold-start local measurement. The image is eagerly loaded at high priority with sizes that preserve its required pixel density. The mobile crop reduced the hero transfer from approximately 155 KB to 71 KB compared with the high-resolution landscape delivery tested during this update; that intermediate build scored 83. The previous redesign's lower-resolution delivery scored 92, which is not the score of this final photo-quality build. The score does not establish full accessibility conformance. Total Blocking Time is a lab diagnostic and is not a substitute for INP. The public bundle keeps calendar, editor, 3D and server-side validation dependencies out of the initial public load.

Machine-readable measured values are in [lighthouse-mobile-summary.json](lighthouse-mobile-summary.json). The full local report is `.local/lighthouse-photo-quality-final-mobile.json`; photo screenshots and decoded-resolution results are retained under `.local/photo-quality/`. These files and browser-run screenshots under `test-results/` are ignored by Git. Previous dashboard screenshots remain under `.local/`; the public-to-cleaner navigation check retained dashboard styling.

## Configuration still required

The local demo is working with synthetic accounts/data and persistent embedded PostgreSQL. It is not production authentication. Supabase Auth, Storage and Realtime have not been tested against a live project; the storage policy tests use a fixture for Supabase-managed schemas. External recording/transcription processing has not occurred. Recording and transcription remain disabled.

To connect real services, supply the Supabase project configuration securely, apply all migrations, create the first trusted admin, confirm Auth redirects and test the managed service policies. Confirm the phone provider/PWMS integration and routing plan before setting Twilio callbacks. Enable recording/transcription only after supplying their settings and credentials; connect authenticated dispatch and retention schedules. See [integration requirements](integrations.md) and the [README](../README.md).

The cloud environment draft contains the tested installation script and service-start instructions. Saving an environment draft and publishing source to GitHub are separate from deployment. No deployment, domain migration, number purchase or live call was performed.
