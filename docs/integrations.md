# External configuration and references

No Supabase project URL or PWMS repository was supplied. Existing configuration metadata and exported variable names were checked; the project/provider variables are absent. Platform Git authentication works and does not require another GitHub token.

| Integration | Non-secret configuration | Server-only credentials | Current state |
| --- | --- | --- | --- |
| Supabase | Project URL, public anon/publishable key, Auth redirects, invite-only sign-up policy | Service-role key in secure environment settings | Schema, interfaces and local policy tests implemented; real service stack unconnected |
| Twilio | Account SID, HTTPS callback base, E.164 staff destination, confirmed number-routing plan | Auth token available to the server for webhook verification | Adapter and callbacks scaffolded; no live routing/actions |
| AssemblyAI | Explicit transcription enablement, HTTPS callback base, scheduler | API key, private webhook token | Durable job/adapter/callback foundation; no external processing performed |
| Retention/dispatch | Authenticated scheduled POSTs, function duration support | Cron bearer secret | Routes implemented; no scheduler configured |

For cloud proxy-secret bindings, destination hosts will be the actual Supabase project host, `api.twilio.com` and `api.assemblyai.com`. Do not guess the Supabase hostname or add inert secret bindings without a destination. Signature verification and callback-token comparisons need actual server-side values; network proxy placeholders are not a substitute for local signing material. No secret values belong in the source, client bundles, inventory or chat.

Official documentation inspected on 2 October 2026:

- Next.js 16.3.8 installation: https://nextjs.org/docs/app/getting-started/installation
- Supabase SSR Auth: https://supabase.com/docs/guides/auth/server-side/nextjs — refreshed claims in `proxy.ts`, verified user lookup for access checks.
- Tiptap Next.js: https://tiptap.dev/docs/editor/getting-started/install/nextjs — `immediatelyRender: false` for hydration.
- React Three Fiber performance: https://r3f.docs.pmnd.rs/advanced/scaling-performance — demand rendering, bounded DPR and explicit lazy loading.
- Twilio signatures: https://www.twilio.com/docs/usage/security — use exact public callback URL and all callback form fields.
- AssemblyAI webhooks: https://www.assemblyai.com/docs/getting-started/webhooks
- AssemblyAI deletion: https://www.assemblyai.com/docs/api-reference/transcripts/delete

FullCalendar’s live documentation returned HTTP 403. Its installed Standard plugin types and the `@fullcalendar/luxon3` package were checked; the working calendar uses `Europe/London`, not UTC coercion or paid resource plugins. The lockfile records exact installed package versions and browser tests exercise the resulting day/week/month calendar.
