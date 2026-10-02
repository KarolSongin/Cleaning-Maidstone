import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Check, Phone, Mail, Clock } from "lucide-react";
import { metadata, breadcrumbs } from "@/lib/seo";
import { business, serviceTasks } from "@/lib/business";
import { publicContent } from "@/lib/repository";
import { ContentBody } from "@/components/content-renderer";
import { BookingSection } from "@/components/booking-section";
import { JsonLd } from "@/components/json-ld";
import { Button } from "@/components/ui/button";
const pages: Record<
  string,
  { title: string; description: string; heading: string; intro: string }
> = {
  "maidstone-domestic-cleaning": {
    title: "Domestic Cleaning Maidstone | Weekly & Fortnightly Cleaner",
    description:
      "Weekly and fortnightly domestic cleaning in Maidstone with an assigned regular cleaner. Clear prices, agreed priorities and local availability.",
    heading: "Regular domestic cleaning in Maidstone.",
    intro:
      "Looking for a regular cleaner in Maidstone? Our weekly and fortnightly domestic cleaning service helps you keep on top of kitchens, bathrooms, dust and floors. We agree the priority rooms before your first visit and aim to assign the same familiar cleaner wherever possible.",
  },
  "about-us": {
    title: "About Cleaning Maidstone | Local Domestic Cleaners",
    description:
      "Learn about Cleaning Maidstone, a local domestic-cleaning business focused on reliable weekly and fortnightly home cleaning.",
    heading: "Local Maidstone cleaners. A personal approach.",
    intro:
      "Cleaning Maidstone is a local domestic-cleaning business focused on dependable weekly and fortnightly appointments. You deal directly with us. We get to know your home, record your priorities and work towards a routine that feels familiar from one visit to the next.",
  },
  "contact-us": {
    title: "Contact a Domestic Cleaner in Maidstone | Cleaning Maidstone",
    description:
      "Ask Cleaning Maidstone about weekly or fortnightly domestic-cleaning availability. Send your postcode and home details for a clear estimate.",
    heading: "Contact Cleaning Maidstone.",
    intro:
      "Looking for a weekly or fortnightly domestic cleaner in Maidstone? Call, email or send your home details below. We’ll check the local diary, discuss your priorities and recommend a realistic visit length and price.",
  },
  pricing: {
    title: "Domestic Cleaning Prices Maidstone | Weekly & Fortnightly",
    description:
      "Clear domestic cleaning prices in Maidstone. Weekly cleaning from £18 per hour and fortnightly cleaning from £19 per hour, with a three-hour minimum.",
    heading: "Domestic cleaning prices in Maidstone.",
    intro:
      "Weekly domestic cleaning starts at £18 per hour and fortnightly cleaning at £19 per hour, with a three-hour minimum. Choose your own cleaning products and cloths, or ask us to bring them at our clearly stated higher rate. We agree the time and priorities before your appointment.",
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
                <h2>What our regular domestic cleaners can take care of</h2>
                <p>
                  We focus on the everyday cleaning that makes your home
                  comfortable to live in. Your checklist is prioritised to fit
                  the time booked; a three-hour visit cannot always cover every
                  task in a larger or heavily used home.
                </p>
                <ul className="check-list">
                  {serviceTasks.map((task) => (
                    <li key={task}>
                      <Check size={18} />
                      {task}
                    </li>
                  ))}
                </ul>
                <div className="service-detail-card">
                  <h3>Weekly domestic cleaning</h3>
                  <p>
                    A weekly appointment suits busy family homes, homes with
                    pets and anyone who wants kitchens, bathrooms and floors
                    maintained consistently. It is a useful way to stop everyday
                    housework building up between visits.
                  </p>
                  <h3>Fortnightly domestic cleaning</h3>
                  <p>
                    A clean every other week suits quieter homes and households
                    that can manage light upkeep in between. With more time for
                    dust and limescale to build up, fortnightly visits are
                    priced slightly higher.
                  </p>
                  <Link href="/pricing/" className="text-link">
                    Compare weekly and fortnightly prices{" "}
                    <ArrowUpRight size={18} />
                  </Link>
                </div>
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
                  Your first clean may need more time than later maintenance
                  visits, especially if some rooms have not been cleaned
                  thoroughly recently. Tell us honestly about the size of your
                  home, its current condition and the rooms that matter most. We
                  will suggest a realistic first appointment and agree any extra
                  time before work begins.
                </p>
                <h2>Cleaning products, equipment and special surfaces</h2>
                <p>
                  You provide a safe, working vacuum cleaner and a mop suitable
                  for your floors in both pricing options. You can supply your
                  own cleaning products and cloths, or we can bring standard
                  products and cloths at the higher hourly rate.
                </p>
                <p>
                  Please mention allergies, pets, natural stone, untreated wood,
                  delicate finishes and products you prefer us to use or avoid.
                  Product labels and manufacturer instructions take priority
                  when caring for special surfaces.
                </p>
                <h2>How to request a regular cleaning slot</h2>
                <p>
                  Send your postcode, number of bedrooms and bathrooms, weekly
                  or fortnightly preference and two or three suitable days or
                  time windows. Include parking, access and any priority rooms.
                  We check the local route, recommend the appointment length and
                  discuss availability with you.
                </p>
                <Link href="/pricing/" className="text-link">
                  See clear hourly prices <ArrowUpRight size={18} />
                </Link>
              </div>
              <aside className="service-aside">
                <div className="page-photo">
                  <Image
                    src="/images/bathroom.webp"
                    alt="Clean bathroom with a walk-in shower and tiled floors"
                    fill
                    sizes="(max-width:760px) 100vw, 40vw"
                  />
                </div>
                <div className="service-quick-price">
                  <p className="eyebrow">Your regular clean</p>
                  <h3>
                    Clear prices.
                    <br />A useful routine.
                  </h3>
                  <p>
                    Weekly from <strong>£18/hour</strong>
                    <br />
                    Fortnightly from <strong>£19/hour</strong>
                  </p>
                  <small>
                    With your products and cloths.
                    <br />
                    Three-hour minimum. You provide a vacuum and mop.
                  </small>
                  <Button asChild>
                    <Link href="#book">
                      Check availability
                      <ArrowUpRight size={17} />
                    </Link>
                  </Button>
                </div>
              </aside>
            </section>
          )}
          {slug === "about-us" && (
            <section className="section two-column">
              <div className="page-photo">
                <Image
                  src="/images/home-detail.webp"
                  alt="A bright home with dining and living spaces opening onto a garden"
                  fill
                  sizes="(max-width:760px) 100vw, 40vw"
                />
              </div>
              <div className="prose">
                <h2>A local business, built around regular home cleaning</h2>
                <p>
                  Cleaning Maidstone focuses on regular domestic cleaning rather
                  than trying to cover every specialist service. Our approach is
                  straightforward: organise dependable weekly and fortnightly
                  appointments, communicate clearly and learn how you like your
                  home cared for.
                </p>
                <p>
                  Every household has different priorities. For some, it is
                  keeping the kitchen and bathrooms fresh. For others, it is the
                  dust, floors and busy family spaces that need attention. We
                  listen before the first clean and agree a useful routine for
                  the time you book.
                </p>
                <h2>A familiar cleaner makes a difference</h2>
                <p>
                  We aim to assign the same regular cleaner wherever possible.
                  Familiarity means less time explaining your rooms, preferred
                  products and priorities at every appointment. If holiday cover
                  or a permanent change is needed, we let you know in advance.
                </p>
                <h2>Clear communication, from the first enquiry</h2>
                <p>
                  You deal directly with Cleaning Maidstone. We check the local
                  diary, suggest a realistic visit length and explain the hourly
                  rate before an appointment is agreed. If a first clean needs
                  more time, that is discussed with you first.
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
          {slug === "contact-us" && (
            <section className="section contact-options">
              <article className="contact-option">
                <Phone size={25} />
                <h2>Give us a call</h2>
                <a href={"tel:" + business.tel}>{business.phone}</a>
                <p>
                  Talk through your home, preferred days and cleaning
                  priorities.
                </p>
              </article>
              <article className="contact-option">
                <Mail size={25} />
                <h2>Send an email</h2>
                <a href={"mailto:" + business.email}>{business.email}</a>
                <p>
                  Include your postcode and whether you need weekly or
                  fortnightly cleaning.
                </p>
              </article>
              <article className="contact-option">
                <Clock size={25} />
                <h2>When to reach us</h2>
                <p>
                  {business.hours}.<br />
                  Saturday and Sunday closed.
                  <br />
                  Appointments depend on the local diary.
                </p>
              </article>
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
      {slug !== "privacy" && <BookingSection />}
    </main>
  );
}
