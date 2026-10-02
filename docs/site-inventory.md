# Live site inventory — 2 October 2026

Rechecked the five public pages and internal navigation during the public redesign on the same date. Crawled the homepage, navigation, footer links, robots.txt, sitemap index, page sitemap and block sitemap after network access was enabled. All five public pages were inspected. The sitemaps and internal navigation contain **no existing blog posts**. `/blocks/footer/` is an empty WordPress component endpoint, not a useful public page. Social networks and the external web designer are outbound links and were not crawled.

| URL                           | Existing title                                                | Existing description                                                                                                                                  | Migration    |
| ----------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| /                             | Domestic Cleaners in Maidstone \| Weekly House Cleaning       | Reliable domestic cleaning in Maidstone with a regular assigned cleaner. Weekly and fortnightly home cleans. Check Cleaning Maidstone’s availability. | Preserve URL |
| /maidstone-domestic-cleaning/ | Domestic Cleaning Maidstone \| Weekly & Fortnightly Cleaner   | Weekly and fortnightly domestic cleaning in Maidstone with an assigned regular cleaner. Clear prices, agreed priorities and local availability.       | Preserve URL |
| /about-us/                    | About Cleaning Maidstone \| Local Domestic Cleaners           | Learn about Cleaning Maidstone, a local domestic-cleaning business focused on reliable weekly and fortnightly home cleaning.                          | Preserve URL |
| /contact-us/                  | Contact a Domestic Cleaner in Maidstone \| Cleaning Maidstone | sk Cleaning Maidstone about weekly or fortnightly domestic-cleaning availability. Send your postcode and home details for a clear estimate.           | Preserve URL |
| /pricing/                     | Domestic Cleaning Prices Maidstone \| Weekly & Fortnightly    | Clear domestic cleaning prices in Maidstone. Weekly cleaning from £18 per hour and fortnightly cleaning £19 per hour, with a three-hour minimum.      | Preserve URL |

## Verified facts

- Phone: **07767 211 725** (`+447767211725`). Email: **marta@cleaningmaidstone.co.uk**. Enquiries Monday–Friday, 8am–8pm; weekends closed in the existing footer.
- Regular weekly and fortnightly domestic cleaning; assigned regular cleaner wherever possible; priorities agreed before the first clean.
- Customer products/cloths: weekly £18/hour, fortnightly £19/hour. Business products/cloths: weekly £22/hour, fortnightly £23/hour. Three-hour minimum: £54/£57 or £66/£69 respectively. Customer provides a safe working vacuum and suitable mop in either option.
- Coverage: Maidstone town centre and selected neighbourhoods: Allington, Barming, Bearsted, Coxheath, Downswood, Grove Green, Loose, Penenden Heath, Vinters Park and Weavering. Slots depend on route and diary.
- Tasks: reachable surface dusting, vacuuming, suitable hard-floor mopping, kitchen surfaces and cabinet fronts, bathrooms/mirrors, bedrooms/bed making with fresh linen supplied, household bins on request.
- Current service page excludes end-of-tenancy, commercial, carpet extraction, exterior windows, post-building work, unsafe-height work, laundry and ironing. Interior ovens/fridges/cupboards require specific agreement and extra time.
- First cleans may need extra time. Additional hours/access costs are discussed first. Pricing asks for at least 48 hours’ notice of changes; payment/cancellation terms are confirmed at booking.
- An enquiry does not confirm a booking. Existing CTAs point to `/#book`.

## Content discrepancies and migration decisions

The older About page mentions eco-friendly practices, deep cleans, end-of-tenancy and ironing; the updated service/home copy explicitly limits the current offer. The original logo also mentions ironing. The scaffold preserves the original logo but follows the current service scope in page copy. The website displays a Google 5.0 rating without an inspectable review link or count. On 3 October, the owner confirmed the 5.0 rating and supplied the Google business-profile link listed below; the new hero badge uses that confirmation. No review count or testimonial was invented. No public office address was found, so none is supplied in copy or JSON-LD.

`/contact` resolves to `/contact-us/` on the live site. The scaffold makes this a single permanent 308 redirect. Trailing-slash canonical paths are retained; all internal links use them. `/#book` remains the enquiry section. Legacy `/sitemap_index.xml`, `/page-sitemap.xml` and `/wp-sitemap.xml` redirect directly to the new `/sitemap.xml`. The old block-only sitemap/component endpoints return 404 and are excluded. Unknown URLs return 404 rather than a homepage redirect. New blog content is clearly new editorial content, not a migrated existing article. The live homepage also contains a WhatsApp link to `https://wa.me/447767211725`; that contact destination is retained.

## Existing brand assets

| Local asset                   | Existing source                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `public/images/logo.png`      | `/wp-content/uploads/2024/08/Cleaning-Maidstone-logo.png`                       |
| `public/images/kitchen.webp`  | `/wp-content/uploads/2024/08/cleaning-maidstone-home-banner.png`                |
| `public/images/bathroom.webp` | `/wp-content/uploads/2024/08/cleaning-maidstone-clean-bathroom-with-shower.jpg` |
| `public/images/favicon.png`   | `/wp-content/uploads/2024/08/cropped-cleaning-maidstone-favicon-270x270.png`    |

Original photographs are retained from the existing business website and locally optimised. Additional locally served stock interiors and font licences are documented in [public-redesign.md](public-redesign.md). They are not asserted to depict customer jobs. Brand colours are navy/blue, pink, white and the logo’s secondary teal. No public area pages were discovered; no repetitive generated area pages are added.

The full crawl records (text, links, headings, asset URLs and resolved destinations) are in `docs/live-site-inventory.json`.

## Social and Google destinations — 3 October 2026

The homepage, About and Contact pages all contain these three social destinations:

- Facebook: https://www.facebook.com/profile.php?id=61563915484605
- Instagram: https://www.instagram.com/cleaning_maidstone/
- X: https://x.com/MaidstoneClean

The owner supplied https://share.google/np167DFyhdcAgl6eH for Google reviews. It returned HTTP 200 after redirecting to Google's Cleaning Maidstone business profile, identified by `kgmid=/g/11y7jl73ff`. The visible rating is the owner's confirmed 5.0 out of 5; it is maintained locally rather than fetched live.
