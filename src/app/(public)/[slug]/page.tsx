import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Check } from "lucide-react";
import { metadata, breadcrumbs } from "@/lib/seo";
import { business, serviceTasks } from "@/lib/business";
import { publicContent } from "@/lib/repository";
import { ContentBody } from "@/components/content-renderer";
import { EnquiryForm } from "@/components/enquiry-form";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
import { demoEnabled } from "@/lib/local-db";
const pages: Record<
  string,
  { title: string; description: string; heading: string; intro: string }
> = {
  "maidstone-domestic-cleaning": {
    title: "Domestic Cleaning Maidstone | Weekly & Fortnightly Cleaner",
    description:
      "Weekly and fortnightly domestic cleaning in Maidstone with an assigned regular cleaner. Clear prices, agreed priorities and local availability.",
    heading: "A dependable routine. A home that feels like you.",
    intro:
      "Weekly and fortnightly domestic cleaning works best when your cleaner knows your home. We agree the important rooms, surfaces and tasks, then build a useful routine around the time booked.",
  },
  "about-us": {
    title: "About Cleaning Maidstone | Local Domestic Cleaners",
    description:
      "Learn about Cleaning Maidstone, a local domestic-cleaning business focused on reliable weekly and fortnightly home cleaning.",
    heading: "Local people. A personal approach.",
    intro:
      "Cleaning Maidstone is a local business focused on regular domestic cleaning. Customers deal directly with us and receive a clearly assigned cleaner, wherever possible. We record your priorities so each visit starts with an understanding of your home.",
  },
  "contact-us": {
    title: "Contact a Domestic Cleaner in Maidstone | Cleaning Maidstone",
    description:
      "Ask Cleaning Maidstone about weekly or fortnightly domestic-cleaning availability. Send your postcode and home details for a clear estimate.",
    heading: "Let’s talk about your home.",
    intro:
      "Looking for a weekly or fortnightly cleaner in Maidstone? Send a few details and suitable days. We’ll check the local schedule and recommend a realistic visit length.",
  },
  pricing: {
    title: "Domestic Cleaning Prices Maidstone | Weekly & Fortnightly",
    description:
      "Clear domestic cleaning prices in Maidstone. Weekly cleaning from £18 per hour and fortnightly cleaning from £19 per hour, with a three-hour minimum.",
    heading: "Clear prices. Thoughtful care.",
    intro:
      "Regular cleaning is charged by the hour, with a three-hour minimum. Choose your own products and cloths, or let us bring them. We agree the priorities and timing before your appointment.",
  },
  privacy: {
    title: "Privacy notice | Cleaning Maidstone",
    description:
      "How Cleaning Maidstone handles website enquiries and service information.",
    heading: "Your information, handled with care.",
    intro:
      "We use the contact and home details you submit to answer your enquiry and organise the cleaning service you request. Please avoid sending sensitive information through the public form.",
  },
};
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const edited = await publicContent("page", slug);
  const page = pages[slug];
  return edited
    ? metadata(
        edited.seo_title || edited.title,
        edited.seo_description || edited.excerpt,
        "/" + slug + "/",
      )
    : page
      ? metadata(page.title, page.description, "/" + slug + "/")
      : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await publicContent("page", slug);
  const page = pages[slug];
  if (!content && !page) notFound();
  const title = content?.title || page.heading;
  return (
    <main id="main">
      <JsonLd data={breadcrumbs(title, "/" + slug + "/")} />
      {slug === "maidstone-domestic-cleaning" && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Regular domestic cleaning",
            serviceType: "Weekly and fortnightly domestic cleaning",
            provider: { "@id": business.url + "/#business" },
            areaServed: business.areas.map((name) => ({
              "@type": "Place",
              name,
            })),
          }}
        />
      )}
      <section className="page-intro section">
        <Link href="/" className="breadcrumb">
          Home / {content?.title || slug.replaceAll("-", " ")}
        </Link>
        <p className="eyebrow">Cleaning Maidstone</p>
        <h1>{title}</h1>
        <p>{content?.excerpt || page.intro}</p>
      </section>
      {content ? (
        <section className="section narrow">
          <ContentBody content={content} />
        </section>
      ) : (
        <>
          {slug === "pricing" && (
            <section className="section pricing-table">
              <div className="section-heading">
                <h2>
                  A routine that fits
                  <br />
                  your home.
                </h2>
                <p>
                  Normal travel within the confirmed service area and agreed
                  priorities are included. A working vacuum cleaner and mop are
                  provided by you in both options.
                </p>
              </div>
              <div className="service-cards">
                {[
                  ["Weekly", "18", "22", "54", "66"],
                  ["Fortnightly", "19", "23", "57", "69"],
                ].map(([frequency, own, ours, minOwn, minOurs]) => (
                  <article key={frequency}>
                    <p className="eyebrow">{frequency} domestic cleaning</p>
                    <h3>
                      £{own}
                      <span className="price-unit"> / hour</span>
                    </h3>
                    <p>
                      With your cleaning products and cloths.
                      <br />
                      From £{minOwn} for a three-hour visit.
                    </p>
                    <hr />
                    <h3>
                      £{ours}
                      <span className="price-unit"> / hour</span>
                    </h3>
                    <p>
                      With our standard products and cloths.
                      <br />
                      From £{minOurs} for a three-hour visit.
                    </p>
                    <Button asChild>
                      <Link href="/#book">
                        Check availability <ArrowUpRight size={16} />
                      </Link>
                    </Button>
                  </article>
                ))}
              </div>
              <div className="prose narrow">
                <h2>Always agreed first</h2>
                <p>
                  A first clean can need more time. Extra hours and any paid
                  parking or unusual access costs are discussed before the
                  appointment. We never add extra hours without agreement.
                </p>
                <h2>If your plans change</h2>
                <p>
                  Please give at least 48 hours’ notice to change or cancel a
                  regular appointment. Cancellation, missed-access and payment
                  terms are confirmed when your arrangement is booked.
                </p>
              </div>
            </section>
          )}
          {slug === "maidstone-domestic-cleaning" && (
            <section className="section two-column">
              <div className="prose">
                <h2>The everyday, looked after.</h2>
                <ul className="check-list">
                  {serviceTasks.map((task) => (
                    <li key={task}>
                      <Check size={18} />
                      {task}
                    </li>
                  ))}
                </ul>
                <h2>What’s outside the regular service?</h2>
                <p>
                  End-of-tenancy, commercial, post-building, carpet extraction,
                  exterior windows, unsafe-height work, laundry and ironing are
                  outside our regular domestic service. Oven, fridge and
                  cupboard interiors require a specific agreement and extra
                  time.
                </p>
                <h2>Before the first visit</h2>
                <p>
                  Tell us about allergies, pets, parking, delicate surfaces and
                  any preferred products. Please have your vacuum cleaner and
                  mop ready. We agree which rooms need the most attention and
                  what fits in the time booked.
                </p>
                <Link href="/pricing/" className="text-link">
                  See clear hourly prices <ArrowUpRight size={18} />
                </Link>
              </div>
              <div className="page-photo">
                <Image
                  src="/images/bathroom.webp"
                  alt="Bathroom photograph used on the existing Cleaning Maidstone website"
                  fill
                  sizes="(max-width:760px) 100vw, 40vw"
                />
              </div>
            </section>
          )}
          {slug === "about-us" && (
            <section className="section two-column">
              <div className="page-photo">
                <Image
                  src="/images/kitchen.webp"
                  alt="A bright kitchen from the Cleaning Maidstone website"
                  fill
                  sizes="(max-width:760px) 100vw, 40vw"
                />
              </div>
              <div className="prose">
                <h2>Care that gets to know your home.</h2>
                <p>
                  Our focus is dependable weekly and fortnightly appointments,
                  clear communication and consistent standards. We learn how you
                  like your home cared for and keep the diary organised around
                  local routes.
                </p>
                <h2>In your neighbourhood</h2>
                <p>
                  Regular appointments cover Maidstone town centre and selected
                  neighbourhoods: {business.areas.slice(1).join(", ")}.
                  Availability depends on the current route and diary.
                </p>
                <Link href="/contact-us/" className="text-link">
                  Say hello <ArrowUpRight size={18} />
                </Link>
              </div>
            </section>
          )}
          {slug === "privacy" && (
            <section className="section narrow prose">
              <h2>Enquiries and service records</h2>
              <p>
                We use your name, contact details, postcode and preferences to
                respond and manage your requested service. Operational records
                are restricted to authorised staff; cleaners receive only the
                information needed for assigned jobs.
              </p>
              <h2>Website and account storage</h2>
              <p>
                The public site does not add advertising trackers. Staff
                accounts use essential authentication cookies. A local
                demonstration stores synthetic records on the development
                machine.
              </p>
              <h2>Calls and recordings</h2>
              <p>
                Call recording and transcription are disabled in this initial
                platform. If enabled later, a notice, retention period and
                secure access will be configured before use.
              </p>
              <h2>Questions and your rights</h2>
              <p>
                Contact{" "}
                <a href={"mailto:" + business.email}>{business.email}</a> about
                your information, correction or deletion. This initial notice
                must be reviewed with the business’s actual retention periods
                and legal basis before deployment.
              </p>
            </section>
          )}
        </>
      )}
      {slug !== "privacy" && (
        <section id="book" className="booking-section section">
          <div>
            <p className="eyebrow">Your first step</p>
            <h2>
              Tell us what
              <br />
              home means to you.
            </h2>
            <p>
              We’ll confirm availability, estimated cleaning time and price
              together. Submitting this enquiry does not confirm a booking.
            </p>
            <a className="contact-large" href={"tel:" + business.tel}>
              {business.phone}
            </a>
            <a href={"mailto:" + business.email}>{business.email}</a>
            <small>{business.hours}</small>
          </div>
          <EnquiryForm demo={demoEnabled()} />
        </section>
      )}
    </main>
  );
}
