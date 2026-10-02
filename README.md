# Cleaning Maidstone

A Next.js website and operations scaffold, created from the existing business website and the owner’s brief. Existing public URLs, contact details and published rates are preserved. The live website/domain and phone routing have not been changed.

## Run locally

For setup on your own computer, follow [local-testing.md](docs/local-testing.md), including Windows/macOS commands and demo sign-in instructions.

Requires Node.js 20.9+ (verified with Node 24.19.0), npm and Git. For a fresh checkout on your own computer:

```sh
git clone https://github.com/KarolSongin/Cleaning-Maidstone.git
cd Cleaning-Maidstone
npm ci
cp .env.example .env.local  # only if .env.local does not already exist
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`. Cloud tasks use the existing `/workspace/Cleaning-Maidstone` checkout and do not need another clone or Git worktree.

The server binds to loopback port 3000. The homepage, original service/About/contact/pricing paths and journal are server-rendered. `/login/` contains explicitly labelled Admin and Cleaner demo buttons when `DEMO_MODE=local`. Demo records persist in `.local/database`; the demo session signing key is generated locally. Neither path is tracked or included in deployment tracing. Demo mode is refused on Vercel. Never expose this demo server through a public tunnel or use its accounts for real customer data.

```sh
npm run build
npm run start
```

Only one process can use a PGlite database directory at a time. Stop the server you started before rebuilding/restarting it or opening that directory in another process. Unit tests use an in-memory database. Browser tests use port 3001 and a fresh named database under `.local/`, so they do not modify the normal demo. Set `CHROMIUM_PATH` if Chromium is not installed at `/usr/bin/chromium`.

## What works in the local demo

- Responsive public site, preserved URLs, verified hourly prices, current contact details, FAQs, coverage list, SEO metadata/JSON-LD, sitemap, robots and proper 404s.
- Enquiries persist through the validated server endpoint, with honeypot, timing check and database rate limit. Demo submissions do not contact the business or confirm bookings.
- Customer records, enquiry statuses, internal notes and follow-up tasks persist.
- Admin day/week/month calendar and cleaner filter; create/assign bookings, weekly/fortnightly recurrence, drag or form rescheduling and cancellation of a single occurrence.
- Database constraints reject overlaps, out-of-availability work and approved leave. Recurrence preserves Europe/London wall time through DST. Skipped/repeated local clock times are rejected explicitly.
- Cleaner portal exposes assigned addresses/instructions only, with list and read-only day/week/month calendar views. Cleaners can open job details and mark their own work started/completed, but cannot create, move, resize, reassign or cancel visits. Availability/leave requests persist for admin review.
- Tiptap articles/landing pages, structured sections, image uploads, SEO fields, authors/categories/dates, drafts, authenticated preview, publishing and unpublishing. Public content is refreshed on publishing mutations; drafts return 404 for public requests. The `home` page adds editable editorial content after the fixed homepage sections, before the enquiry form.
- Lazy 3D room with ordinary HTML task controls, static/reduced-motion fallback and on-demand rendering.
- Local sample call events, caller-match suggestion, manual association, admin notes, follow-ups and distinct unavailable/failed recording/transcript states. Repeated events do not duplicate conversations or transcript stages.

## Connect Supabase

1. Use a dedicated project. Apply every SQL migration in `supabase/migrations` with the Supabase CLI or project SQL editor. Storage and Realtime migrations rely on Supabase-managed schemas/publication; the embedded demo tests their policy behaviour using fixtures and does not run a complete Supabase service stack.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the server-only `SUPABASE_SERVICE_ROLE_KEY` securely. Set `DEMO_MODE` to an empty value. Keep keys out of Git and chat. On Vercel, use its environment settings. Cloud proxy placeholders can authenticate supported HTTPS requests but are not raw keys for local signature computation.
3. Disable public sign-ups in Supabase. Add the deployed `/auth/callback/` URL to the Auth redirect allowlist. Create the first admin using a trusted project-owner operation, then update that user’s `profiles.role` to `admin` with the database owner. Application users have no role-update grant. Admin invitations create cleaner profiles with Monday–Friday 8am–8pm initial availability.
4. Confirm RLS, Storage and Auth behaviour against the actual project before entering real data. Signed-in operations use the user’s session and RLS; only public enquiry intake and verified provider processing use the service key. Realtime subscriptions respect row policies; the cleaner subscription excludes delete payloads and listens only for visit insert/update events.

`src/lib/database.types.ts` is generated from the applied business migrations. To regenerate it from the embedded schema, run `npm run db:types:demo`. With a running local Supabase stack, `npm run db:types` uses Supabase’s generator. Do not run either command in the onboarding installation script because it rewrites a repository file.

## Phone and transcription integration

No PWMS repository/provider details were supplied. `src/lib/phone.ts` supplies an adapter contract and a Twilio implementation. The existing **07767 211 725** number is retained in public content; no number has been bought, ported, forwarded or called.

After choosing routing with the business/provider, possible options include an existing provider SIP/webhook connection, forwarding from the current number to a configured provider number, or porting only after eligibility is confirmed. Forwarding an existing mobile number cannot by itself guarantee preservation of caller ID or create provider events; test the chosen provider’s behaviour. Outbound/inbound routing costs and recording notice wording must be agreed before activation.

Configure Twilio’s account SID/auth token, an E.164 staff destination and the exact HTTPS `TWILIO_WEBHOOK_BASE_URL`. `/api/phone/voice/` returns the routing TwiML; its dial-leg/status/recording callbacks validate Twilio signatures and account ID. Callback URLs include the original call SID to correlate forwarded legs. The original incoming event is authoritative for caller identity. Number matches remain suggestions until an admin confirms them.

Recording remains disabled unless `CALL_RECORDING_ENABLED=true`, a notice and a 1–365 day retention period are configured. Recording playback is an authenticated admin stream; expired recordings cannot be played. Deleting a recording also removes associated transcript data and known AssemblyAI results before removing local metadata.

AssemblyAI transcription remains disabled unless `TRANSCRIPTION_ENABLED=true`, its API key and a private callback token are supplied. Recording callbacks enqueue durable database jobs only when transcription is configured. An external scheduler must POST to `/api/jobs/transcriptions/` with `Authorization: Bearer <CRON_SECRET>`; jobs use leases and bounded retries, upload authorised audio, submit asynchronous processing and finish through `/api/transcriptions/callback/`. The callback authenticates its token and fetches results from the provider; it does not trust transcript text from the callback body. Dispatch is at least once: an interruption after provider submission but before persisting its ID can create a second provider job. This needs provider-level reconciliation before large-scale operation.

Schedule an authenticated POST to `/api/jobs/retention/` to remove expired provider audio, associated transcripts and metadata. Until a scheduler is connected, expiration restricts playback but does not itself delete provider files. Validate the Vercel plan’s function-duration limit (the dispatcher requests 120 seconds) or run the dispatcher in a suitable durable worker. No background work is left running after an HTTP response.

## Validation

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Focused PostgreSQL tests cover RLS/grants, public/private storage policies, own-job projections, role escalation, transitions, enquiries/throttling, publishing, DST, overlaps, leave conflicts, retry correlation and durable transcript stages. Playwright covers desktop/mobile rendered HTML, metadata, keyboard navigation, enquiry/customer persistence, simultaneous assignment requests, route/API separation, publishing/unpublishing, recording access, sample calls and reduced-motion controls.

See [verification.md](docs/verification.md) for measured outcomes and limits. Live Supabase Auth/Realtime/Storage and Twilio/AssemblyAI end-to-end behaviour remain unverified until credentials and provider configuration are supplied. No deployment or domain/data migration has been performed.

## Review before deployment

Review the short privacy notice and actual business retention/legal basis, confirm licensed use of recovered assets and reconcile the older About/logo references to ironing with the current service scope. Recurring series are materialised for a chosen 1–26 occurrence horizon; automatic series extension and whole-series editing are not implemented. Cleaner profile deactivation/editing and comprehensive media-library management are outside this initial scaffold. Customer conversion pre-fills a customer form; admins still enter/confirm an address and explicitly update the lead status.

The source repository is [KarolSongin/Cleaning-Maidstone](https://github.com/KarolSongin/Cleaning-Maidstone), on the `main` branch. Publishing source to GitHub and saving an environment draft are separate from deploying the application.

- [Site inventory and migration map](docs/site-inventory.md)
- [Architecture](docs/architecture.md)
- [Integration requirements and official references](docs/integrations.md)
- [Public redesign and asset sources](docs/public-redesign.md)
