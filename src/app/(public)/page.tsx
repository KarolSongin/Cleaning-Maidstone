import Link from "next/link";
import Image from "next/image";
import { cache } from "react";
import {
  ArrowUpRight,
  Check,
  CalendarDays,
  HeartHandshake,
  MapPin,
  Sparkles,
  Bath,
  CookingPot,
  Sofa,
  BedDouble,
  Phone,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingSection } from "@/components/booking-section";
import { JsonLd } from "@/components/json-ld";
import { ContentBody } from "@/components/content-renderer";
import { business, faqs } from "@/lib/business";
import { metadata, businessSchema } from "@/lib/seo";
import { publicContent } from "@/lib/repository";
export const dynamic = "force-dynamic";
const homeContent = cache(() => publicContent("page", "home"));
export async function generateMetadata() {
  const edited = await homeContent();
  return metadata(
    edited?.seo_title ||
      "Domestic Cleaners in Maidstone | Weekly House Cleaning",
    edited?.seo_description ||
      "Reliable domestic cleaning in Maidstone. Weekly from £18/hour, fortnightly from £19/hour. A familiar cleaner, agreed priorities and a three-hour minimum.",
  );
}
const rooms = [
  {
    Icon: CookingPot,
    title: "Kitchens",
    text: "Worktops, sink, hob surface and cupboard fronts. The everyday spaces that work hardest.",
    detail: "Clean surfaces. A fresh start.",
  },
  {
    Icon: Bath,
    title: "Bathrooms",
    text: "Showers, baths, basins, toilets and mirrors, with attention to the surfaces you use every day.",
    detail: "Ready for your morning routine.",
  },
  {
    Icon: Sofa,
    title: "Living spaces",
    text: "Dust reachable furniture, vacuum carpets and rugs, and mop suitable hard floors.",
    detail: "Room to put your feet up.",
  },
  {
    Icon: BedDouble,
    title: "Bedrooms",
    text: "Regular dusting and floors, plus bed making when you leave fresh linen ready.",
    detail: "A little more rest. A little less work.",
  },
];
export default async function Home() {
  const edited = await homeContent();
  return (
    <main id="main">
      <JsonLd data={businessSchema()} />
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-dot" /> Your local, regular cleaning
            service
          </p>
          <h1>
            Domestic cleaning
            <br />
            in <em>Maidstone.</em>
          </h1>
          <p className="hero-tagline">A home to enjoy. More time for you.</p>
          <p className="hero-description">
            Spend less time catching up with housework. Our weekly and
            fortnightly domestic cleaners get to know your home, your priorities
            and your routine.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="#book">
                Find your regular cleaner <ArrowUpRight size={19} />
              </Link>
            </Button>
            <Link href="/maidstone-domestic-cleaning/" className="text-link">
              What’s included <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-note">
            <span className="mini-check">
              <Check size={12} />
            </span>
            From £18 per hour · 3-hour minimum
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo">
            <Image
              src="/images/living-room.webp"
              alt="Sunlit living room with comfortable seating and leafy houseplants"
              fill
              sizes="(max-width: 760px) calc(100vw - 74px), (max-width: 1100px) calc(52.5vw - 71px), (max-width: 1440px) calc(52.5vw - 92px), 655px"
              loading="eager"
              fetchPriority="high"
            />
            <div className="photo-caption">
              <MapPin size={15} /> Local care. A personal touch.
            </div>
          </div>
          <div className="hero-care-card">
            <span className="care-icon">
              <HeartHandshake size={25} />
            </span>
            <div>
              <strong>Your home, understood.</strong>
              <span>A familiar cleaner, wherever possible.</span>
            </div>
          </div>
          <div className="hero-stamp" aria-hidden="true">
            <Sparkles size={25} />
            <span>
              Less housework.
              <br />
              More living.
            </span>
          </div>
        </div>
      </section>
      <section className="trust-strip" aria-label="Our approach">
        <p>
          <HeartHandshake size={24} />
          <span>
            A familiar face
            <small>The same regular cleaner, wherever possible</small>
          </span>
        </p>
        <p>
          <CalendarDays size={24} />
          <span>
            A routine that fits<small>Weekly or fortnightly appointments</small>
          </span>
        </p>
        <p>
          <Check size={24} />
          <span>
            No guesswork<small>Agreed priorities. Clear hourly prices.</small>
          </span>
        </p>
      </section>
      <section className="section service-section" id="services">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Regular cleaning. Real breathing room.</p>
            <h2>
              A cleaner home,
              <br />
              <em>on your terms.</em>
            </h2>
          </div>
          <p>
            Every home is different. Choose a weekly or fortnightly clean, then
            agree the rooms and tasks that make the biggest difference to your
            day.
          </p>
        </div>
        <div className="service-cards">
          {[
            {
              frequency: "Weekly",
              subtitle: "For a fresh start, every week.",
              own: 18,
              ours: 22,
              min: 54,
              image: "/images/kitchen-detail.webp",
              alt: "Bright kitchen with clean worktops and wooden stools",
              text: "Ideal for busy family homes, homes with pets and anyone who wants kitchens, bathrooms and floors kept on top of consistently.",
              className: "",
            },
            {
              frequency: "Fortnightly",
              subtitle: "A helping hand, every other week.",
              own: 19,
              ours: 23,
              min: 57,
              image: "/images/living-room.webp",
              alt: "A welcoming living room with a sofa and armchairs",
              text: "Regular help for homes that manage light upkeep between visits. More time between cleans, with a dependable place in your routine.",
              className: "service-card-pink",
            },
          ].map((service) => (
            <article className={service.className} key={service.frequency}>
              <div className="service-card-photo">
                <Image
                  src={service.image}
                  alt={service.alt}
                  fill
                  sizes="(max-width:760px) calc(100vw - 50px), (max-width:1280px) calc(50vw - 62px), 578px"
                />
                <span>
                  <CalendarDays size={14} />{" "}
                  {service.frequency === "Weekly"
                    ? "Every 7 days"
                    : "Every 14 days"}
                </span>
              </div>
              <div className="service-card-body">
                <h3>{service.frequency} domestic cleaning</h3>
                <p className="service-subtitle">{service.subtitle}</p>
                <p>{service.text}</p>
                <div className="service-price">
                  £{service.own}
                  <span> / hour</span>
                </div>
                <span className="price-explanation">
                  With your cleaning products & cloths
                </span>
                <div className="service-supplies">
                  <Sparkles size={16} />
                  <span>
                    Prefer us to bring them?{" "}
                    <strong>£{service.ours}/hour</strong>
                  </span>
                </div>
                <div className="service-card-bottom">
                  <small>3-hour minimum · from £{service.min}/visit</small>
                  <Link
                    href="/pricing/"
                    aria-label={service.frequency + " cleaning prices"}
                  >
                    <ArrowUpRight size={23} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="section-footnote">
          <Check size={14} />
          In both options, you provide a safe, working vacuum cleaner and a
          suitable mop.{" "}
          <Link href="/pricing/">See all prices and what’s included.</Link>
        </p>
      </section>
      <section className="section care-section" aria-labelledby="care-heading">
        <div className="care-story">
          <div className="care-story-photo">
            <Image
              src="/images/home-detail.webp"
              alt="Light-filled dining and living spaces opening onto a garden"
              fill
              sizes="(max-width:760px) 100vw, 42vw"
            />
          </div>
          <div className="care-story-note">
            <Sparkles size={24} />
            <p>
              A regular clean.
              <br />
              <em>An everyday difference.</em>
            </p>
          </div>
        </div>
        <div className="care-content">
          <p className="eyebrow">A regular clean built around your home</p>
          <h2 id="care-heading">
            The rooms you live in.
            <br />
            <em>The details you notice.</em>
          </h2>
          <p>
            Some homes need the kitchen and bathrooms prioritised. Others need
            help keeping dust, floors and busy family spaces under control.
            Before the first visit, we agree a practical checklist for the time
            booked.
          </p>
          <div className="room-cards">
            {rooms.map(({ Icon, title, text, detail }) => (
              <article key={title}>
                <Icon size={23} />
                <h3>{title}</h3>
                <p>{text}</p>
                <small>{detail}</small>
              </article>
            ))}
          </div>
          <Link href="/maidstone-domestic-cleaning/" className="text-link">
            Explore our domestic cleaning service <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="personal-section">
        <div className="section personal-inner">
          <div>
            <p className="eyebrow">Thoughtful cleaning. Familiar people.</p>
            <h2>
              Someone who knows
              <br />
              <em>how you like it.</em>
            </h2>
          </div>
          <div>
            <p>
              Regular cleaning works best when you don’t have to start from
              scratch at every visit. We aim to assign the same cleaner wherever
              possible, so your priorities, preferred products and little
              details become part of the routine.
            </p>
            <p>
              You deal directly with Cleaning Maidstone, a local
              domestic-cleaning business. Clear communication and an organised
              local diary help keep your regular clean straightforward.
            </p>
            <Link href="/about-us/" className="text-link">
              Get to know Cleaning Maidstone <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <section className="section steps-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              From your first hello to your regular slot
            </p>
            <h2>
              A little help is
              <br />
              <em>closer than you think.</em>
            </h2>
          </div>
          <Link href="#book" className="text-link">
            Let’s get started <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="steps-grid">
          {[
            [
              "Tell us about your home",
              "Send your postcode, bedrooms and bathrooms, preferred frequency and two or three suitable days.",
            ],
            [
              "Find the right fit",
              "We check the Maidstone diary and suggest a visit length and price for your priorities.",
            ],
            [
              "Agree your first clean",
              "Show your cleaner around and discuss the rooms, surfaces, pets, products and access.",
            ],
            [
              "Make it your routine",
              "If you’re happy after the first visit, continue with your agreed weekly or fortnightly slot.",
            ],
          ].map(([title, text], i) => (
            <article key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="section local-section" id="areas">
        <div className="local-identity">
          <div className="local-pin">
            <MapPin size={32} />
          </div>
          <p className="eyebrow">Your local domestic cleaners</p>
          <h2>
            At home
            <br />
            in <em>Maidstone.</em>
          </h2>
          <p>A local service, organised around local homes.</p>
          <div className="local-line-art" aria-hidden="true">
            <svg viewBox="0 0 440 110" fill="none">
              <path
                d="M0 98h440M30 98V49l29-23 29 23v49M45 98V70h25v28M98 98V36l37-28 37 28v62M120 98V65h29v33M185 98V48l31-22 31 22v50M260 98V28l42-22 42 22v70M282 98V67h38v31M361 98V47l27-20 27 20v51M45 50h23v12H45M119 33h30v16h-30M274 29h18v16h-18M309 29h18v16h-18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className="local-copy">
          <p className="eyebrow">Close to home</p>
          <h2>
            Domestic cleaning across
            <br />
            <em>Maidstone & nearby.</em>
          </h2>
          <p>
            We offer regular appointments in Maidstone town centre and selected
            surrounding neighbourhoods. The diary is planned by local area to
            keep routes practical and arrival times dependable.
          </p>
          <div className="area-list">
            {business.areas.map((area) => (
              <span key={area}>
                <MapPin size={13} />
                {area}
              </span>
            ))}
          </div>
          <p className="section-footnote">
            Availability depends on the current route and diary. Send your
            postcode and preferred days so we can check a suitable slot.
          </p>
          <Link href="#book" className="text-link">
            Check your postcode with us <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="section faq-section">
        <div>
          <p className="eyebrow">Good to know before you enquire</p>
          <h2>
            Your questions,
            <br />
            <em>answered.</em>
          </h2>
          <p>Practical answers about your regular domestic clean.</p>
          <a href={"tel:" + business.tel} className="faq-phone">
            <Phone size={18} />
            <span>
              Prefer a conversation?<strong>{business.phone}</strong>
            </span>
          </a>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer], index) => (
            <details key={question}>
              <summary>
                <span className="faq-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {question}
                <span className="faq-toggle">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      {edited && (
        <section
          className="section"
          aria-label="Additional cleaning information"
        >
          <ContentBody content={edited} />
        </section>
      )}
      <BookingSection />
    </main>
  );
}
