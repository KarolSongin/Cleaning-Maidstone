# Public redesign and cleaner calendar

The public site was redesigned after comparing it directly with the live WordPress pages on 2 October 2026. The homepage now introduces domestic cleaning in Maidstone explicitly, with weekly/fortnightly options, four verified hourly rates, included rooms/tasks, the first-visit process, equipment, coverage and practical FAQs. Service and About pages restore the detail that was missing from the initial scaffold. The service page keeps a concise price/enquiry panel alongside the longer explanation.

Established paths and canonical URLs remain intact. The original logo, public number, email, hours, service scope and rates are retained. The existing WhatsApp destination was verified in the WordPress HTML and restored as an ordinary contact link. Opening a contact link is separate from submitting the local demo form.

The design uses the existing blue/pink identity, a white/light-blue background, locally served DM Sans and DM Serif Display typography, large interior images and responsive layouts. Public styles and font variables are scoped to the public layout so dashboard styling is preserved. Blog cards support the published content image and alternate text, with a stock interior fallback. The homepage respects a published home page's SEO title and description.

The cleaner portal retains its list view and adds a lazy-loaded Standard FullCalendar with London day/week/month views. Mobile starts in day view; desktop starts in week view. Selecting an assigned event opens its job details and moves keyboard focus to them. Editing, dragging, resizing, selection and external dropping are disabled. Server role checks and PostgreSQL permissions still reject cleaner rescheduling, reassignment and cancellation, including their own appointments. Starting/completing assigned work and requesting leave/availability remain separate, authorised actions.

## Asset sources

The original business logo, favicon, kitchen and bathroom assets remain in the public/images/ directory; their original URLs are recorded in [site-inventory.md](site-inventory.md).

Additional stock interior images were downloaded and optimised locally. They are illustrative interiors, not photographs of Cleaning Maidstone customer jobs or its staff.

| Local file                        | Source image                                                 |
| --------------------------------- | ------------------------------------------------------------ |
| public/images/living-room.webp    | https://images.unsplash.com/photo-1600210492486-724fe5c67fb0 |
| public/images/home-detail.webp    | https://images.unsplash.com/photo-1600607687920-4e2a09cf159d |
| public/images/kitchen-detail.webp | https://images.unsplash.com/photo-1556912172-45b7abe8b7e1    |

Unsplash licence: https://unsplash.com/license. Assets are served by this application, so page visits do not fetch them from Unsplash.

DM Sans and DM Serif Display are from Google Fonts, served with next/font/local. Their SIL Open Font License notices are included in src/app/fonts/. Page visits and production builds do not request fonts from Google.

The public copy makes no new claims about reviews, insurance, qualifications, office addresses or guaranteed availability. Recorded Lighthouse measurements and verification outcomes are in [verification.md](verification.md); they do not establish search rankings or field Core Web Vitals.

Public copy is server-rendered, including optional published homepage content before the enquiry form. Its content lookup is memoised within each request and shared with metadata. SEO and sharing metadata are included in the initial HTML head for every client, including on cold starts. Responsive image sizes account for the layout gutters, the hero image uses explicit high fetch priority, and the logo has a lossless WebP derivative.
