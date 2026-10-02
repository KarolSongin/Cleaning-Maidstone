# Verification — 2 October 2026

Verified in this cloud checkout with Node 24.19.0, npm 11.9.0, Next.js 16.3.8 and system Chromium. The initial repository was empty. No existing domain, production data or phone routing was changed.

| Check | Result |
| --- | --- |
| Frozen dependency installation / saved installation script | Passed `npm ci` followed by the production build |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed; the final production build also passed TypeScript checks |
| `npm run test` | 21 tests passed |
| `npm run test:e2e` | 14 journeys passed: seven each on desktop and mobile |
| `npm run build` | Passed; server-rendered public routes and operational/API routes compiled |
| Production startup | Homepage, pricing, robots and sitemap return HTTP 200; anonymous admin access redirects to login |
| Deployment file tracing | All 33 generated trace manifests checked; no `.local/` data, `.env` files or browser-test results included |

The focused tests run actual PostgreSQL policies and transactional operations in PGlite. They cover anonymous/cleaner restrictions, own-job projections, denied role changes, storage policies, enquiry persistence/throttling, publishing, London DST transitions, invalid local clock times, concurrent overlaps, availability/leave conflicts and individual-occurrence changes. Phone tests cover signature validation, altered payloads/URLs, duplicate and out-of-order events, forwarded-leg correlation, transcript-stage deduplication and durable job claims.

Browser journeys cover initial rendered content/metadata, preserved contact redirect, 404s, mobile overflow, keyboard navigation, enquiry validation/persistence, customer editing, competing assignments, calendar navigation, direct API/recording restrictions, same-origin checks, authenticated previews, publishing/unpublishing, duplicate sample calls, failed transcription and reduced-motion task controls. Each run uses a fresh synthetic database; the normal demo database is preserved.

An additional production-browser smoke check activated the lazy 3D canvas using Chromium software WebGL, selected the Floors task through its HTML control and verified that the canvas unmounted when scrolled out of view. No browser runtime errors were observed.

## Measured mobile performance

Lighthouse 13.5.0 measured the production homepage at 18:46 UTC using its mobile simulated throttling (4× CPU slowdown, 150 ms RTT, approximately 1.6 Mbps throughput). This is a local laboratory measurement, not deployed-site or field data. No Lighthouse runtime errors or warnings were reported.

| Metric | Target | Measured |
| --- | --- | --- |
| Performance score | At least 90 | **97** |
| Accessibility / Best Practices / SEO | — | **100 / 100 / 100** |
| Largest Contentful Paint | At or below 2.5 s | **2.520 s**, slightly above the target |
| Cumulative Layout Shift | At or below 0.1 | **0** |
| First Contentful Paint | — | **0.880 s** |
| Total Blocking Time | — | **69 ms** |
| Interaction to Next Paint | At or below 200 ms | Not measured; field INP needs real usage |

The score does not establish full accessibility conformance. Total Blocking Time is a lab diagnostic and is not a substitute for INP. The optimised public bundle keeps calendar, editor, 3D and server-side validation dependencies out of the initial public load. An ordinary static room and HTML task controls remain available before 3D activation and with reduced motion.

Machine-readable measured values are in [lighthouse-mobile-summary.json](lighthouse-mobile-summary.json). The full local report and homepage screenshots are retained under the ignored `.local/` directory; the browser-run screenshots are in ignored `test-results/`.

## Configuration still required

The local demo is working with synthetic accounts/data and persistent embedded PostgreSQL. It is not production authentication. Supabase Auth, Storage and Realtime have not been tested against a live project; the storage policy tests use a fixture for Supabase-managed schemas. External recording/transcription processing has not occurred. Recording and transcription remain disabled.

To connect real services, supply the Supabase project configuration securely, apply all migrations, create the first trusted admin, confirm Auth redirects and test the managed service policies. Confirm the phone provider/PWMS integration and routing plan before setting Twilio callbacks. Enable recording/transcription only after supplying their settings and credentials; connect authenticated dispatch and retention schedules. See [integration requirements](integrations.md) and the [README](../README.md).

The cloud environment draft contains the tested installation script and service-start instructions. These checks preceded initial source publication to GitHub; saving an environment draft and publishing source are separate from deployment. No deployment, domain migration, number purchase or live call was performed.
