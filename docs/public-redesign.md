# Public redesign and cleaner calendar

The public site was redesigned after comparing it directly with the live WordPress pages on 2 October 2026. The homepage now introduces domestic cleaning in Maidstone explicitly, with weekly/fortnightly options, four verified hourly rates, included rooms/tasks, the first-visit process, equipment, coverage and practical FAQs. Service and About pages restore the detail that was missing from the initial scaffold. The service page keeps a concise price/enquiry panel alongside the longer explanation.

Established paths and canonical URLs remain intact. The original logo, public number, email, hours, service scope and rates are retained. The existing WhatsApp destination was verified in the WordPress HTML and restored as an ordinary contact link. Opening a contact link is separate from submitting the local demo form.

The design uses the existing blue/pink identity, a white/light-blue background, locally served DM Sans and DM Serif Display typography, large interior images and responsive layouts. Public styles and font variables are scoped to the public layout so dashboard styling is preserved. Blog cards support the published content image and alternate text, with a stock interior fallback. The homepage respects a published home page's SEO title and description.

The cleaner portal retains its list view and adds a lazy-loaded Standard FullCalendar with London day/week/month views. Mobile starts in day view; desktop starts in week view. Selecting an assigned event opens its job details and moves keyboard focus to them. Editing, dragging, resizing, selection and external dropping are disabled. Server role checks and PostgreSQL permissions still reject cleaner rescheduling, reassignment and cancellation, including their own appointments. Starting/completing assigned work and requesting leave/availability remain separate, authorised actions.

## Asset sources

The original business logo, favicon, kitchen and bathroom assets remain in the public/images/ directory; their original URLs are recorded in [site-inventory.md](site-inventory.md).

Additional stock interior images were downloaded and optimised locally. They are illustrative interiors, not photographs of Cleaning Maidstone customer jobs or its staff.

| Local file                         | Source image                                                 |
| ---------------------------------- | ------------------------------------------------------------ |
| public/images/living-room.webp     | https://images.unsplash.com/photo-1600210492486-724fe5c67fb0 |
| public/images/home-detail.webp     | https://images.unsplash.com/photo-1600607687920-4e2a09cf159d |
| public/images/kitchen-detail.webp  | https://images.unsplash.com/photo-1556912172-45b7abe8b7e1    |
| public/images/bathroom-detail.webp | https://images.unsplash.com/photo-1620626011761-996317b8d101 |

Unsplash licence: https://unsplash.com/license. Assets are served by this application, so page visits do not fetch them from Unsplash.

DM Sans and DM Serif Display are from Google Fonts, served with next/font/local. Their SIL Open Font License notices are included in src/app/fonts/. Page visits and production builds do not request fonts from Google.

The public copy makes no new claims about reviews, insurance, qualifications, office addresses or guaranteed availability. Recorded Lighthouse measurements and verification outcomes are in [verification.md](verification.md); they do not establish search rankings or field Core Web Vitals.

Public copy is server-rendered, including optional published homepage content before the enquiry form. Its content lookup is memoised within each request and shared with metadata. SEO and sharing metadata are included in the initial HTML head for every client, including on cold starts. Responsive image sizes account for the layout gutters, the hero image uses explicit high fetch priority, and the logo has a lossless WebP derivative.

After owner review, the homepage room explorer was removed. Services, About, Prices, Contact, Privacy, the Journal, published articles and custom pages now share the homepage’s split photo hero, rounded pale-blue panel, blue italic accents and pink actions. Visible breadcrumb headers are removed; structured breadcrumb data is retained. Hero links lead to the relevant details or enquiry section, with spacing for the sticky header. Published page/article images appear once in the hero, retain their alternate text and fall back to the locally served interior photographs. Custom pages with no excerpt receive a useful service introduction. Existing 3D components are retained for a later design decision and are no longer imported by the homepage.

The photo-quality update downloads 3,600-pixel-wide JPEG originals from these four sources, using `fit=max` and quality 95, and encodes the local WebP masters at quality 94. Visible photographs use Next.js quality 90; the original logo uses quality 100. Responsive sizes account for the source aspect ratio and the height needed by `object-fit: cover`, so tall panels do not enlarge undersized landscape images. Intermediate image widths reduce unnecessary downloads on high-density screens. The Service page uses the new stock bathroom photograph; its older recovered bathroom image remains available as a legacy asset. Published CMS images continue to use the uploaded original rather than changing remote access or uploaded records.

On screens up to 540 pixels wide, the tall photo panels use square crops selected through `<picture>`, with AVIF at quality 80 and a WebP fallback at quality 90. Ten widths from 384 to 1,920 pixels preserve detail across screen densities. These variants are generated ahead of time, avoiding a first-request encoder delay and downloads of landscape areas hidden by the mobile panels. Desktop and tablet layouts retain their landscape composition and Next.js responsive optimisation. Published CMS images retain their original delivery.

The generated mobile files are committed under `public/images/mobile/`; normal builds require no image downloads or regeneration. After replacing a local master, run this from the repository root with dependencies installed:

```sh
node scripts/generate-mobile-photos.mjs
```

The script uses Sharp supplied by the pinned Next.js dependency and never enlarges a source. Inspect the crops and commit the generated variants together with the source change.
