# Working foundation

One Next.js App Router application. Public routes render on the server; operational routes have independent authenticated layouts and are never publicly cached. Public content uses tag-based caching in Supabase mode; publishing invalidates the page and sitemap. Tiptap, FullCalendar and React Three Fiber load only in the modules that use them.

Supabase is the production system of record. PostgreSQL migrations own permissions, concurrency checks and transactional mutations. Authenticated operations use the user's Supabase session and database RLS; the service key supports validated enquiry intake, authorised account invitations, verified provider callbacks and authenticated integration jobs. Cleaner views project only assigned-work fields. Storage separates public `website-media` from private `call-recordings`.

Without live credentials, `DEMO_MODE=local` uses persistent PGlite PostgreSQL under `.local/`. It installs the same business and transcription-job migrations with synthetic accounts/data. A signed, HttpOnly cookie selects a fixed synthetic role; this mode binds to loopback and is refused on Vercel. It must never be used as production authentication. Schema tests exercise real PostgreSQL policies and mutations, including concurrent overlap constraints.

Recurring visits store a Europe/London wall time plus interval on a series and UTC instants on occurrences. Occurrences are materialised transactionally for a bounded horizon. Exclusion constraints prevent simultaneous overlap; database checks also enforce availability and approved leave. Moving/cancelling an occurrence affects only that visit.

Phone callbacks use a provider adapter and immutable event keys. The Twilio adapter verifies signatures against the configured public URL. Original and forwarded legs share a root call SID. Recording and transcript stages are independent. Durable database jobs use leases and bounded retries; authenticated provider callbacks fetch completed results. An external scheduler triggers dispatch and retention, with no serverless fire-and-forget work. Recording and transcription start disabled. PWMS reuse remains pending repository details.

Deployment target: Vercel + Supabase. Live site migration, domain changes, user invitations, number purchases, porting and routing activation are separate steps.
