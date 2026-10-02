import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Check, CalendarDays, Heart, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnquiryForm } from "@/components/enquiry-form";
import { RoomExperience } from "@/components/room-experience";
import { JsonLd } from "@/components/json-ld";
import { ContentBody } from "@/components/content-renderer";
import { business, faqs } from "@/lib/business";
import { metadata, businessSchema } from "@/lib/seo";
import { demoEnabled } from "@/lib/local-db";
import { publicContent } from "@/lib/repository";
export const dynamic = "force-dynamic";
export const generateMetadata = () =>
  metadata(
    "Domestic Cleaners in Maidstone | Weekly House Cleaning",
    "Reliable domestic cleaning in Maidstone with a regular assigned cleaner. Weekly and fortnightly home cleans. Check Cleaning Maidstone’s availability.",
  );
export default async function Home() {
  const edited = await publicContent("page", "home");
  return (
    <main id="main">
      <JsonLd data={businessSchema()} />
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="tiny-star">✧</span> Your local Maidstone cleaning
            service
          </p>
          <h1>
            A little more <em>calm.</em>
            <br />A lot less
            <br />
            housework.
          </h1>
          <p className="hero-description">
            Thoughtful, regular cleaning for the home you love. A familiar
            cleaner, your priorities, and more time for the things that matter.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="#book">
                Find your regular slot <ArrowUpRight size={19} />
              </Link>
            </Button>
            <Link href="/maidstone-domestic-cleaning/" className="text-link">
              Explore our cleaning
            </Link>
          </div>
          <div className="hero-note">
            <span className="note-line" />
            Weekly & fortnightly · From £18 per hour
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo">
            <Image
              src="/images/kitchen.webp"
              alt="A bright, welcoming kitchen, from Cleaning Maidstone’s existing website"
              fill
              sizes="(max-width: 760px) 100vw, 48vw"
              priority
            />
            <span className="photo-pill">
              <MapPin size={14} />
              Made for life in Maidstone
            </span>
          </div>
          <div className="hero-card">
            <span className="card-sparkle">✧</span>
            <span>
              Your home.
              <br />
              <strong>Your priorities.</strong>
            </span>
            <ArrowUpRight size={22} />
          </div>
          <span className="visual-caption">
            A fresh start. A familiar routine.
          </span>
        </div>
      </section>
      <section className="trust-strip" aria-label="Our approach">
        <p>
          <Heart size={21} />
          <span>
            A familiar cleaner
            <small>Assigned regularly, wherever possible</small>
          </span>
        </p>
        <p>
          <CalendarDays size={21} />
          <span>
            A routine that fits<small>Weekly or fortnightly appointments</small>
          </span>
        </p>
        <p>
          <Check size={21} />
          <span>
            Clear, agreed priorities<small>Care tailored to your home</small>
          </span>
        </p>
      </section>
      {edited && (
        <section className="section">
          <ContentBody content={edited} />
        </section>
      )}
      <section className="section service-section" id="services">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your home, in good hands</p>
            <h2>
              A regular clean.
              <br />
              An everyday difference.
            </h2>
          </div>
          <p>
            From a fresh kitchen to floors you can walk barefoot on. We focus on
            what makes your home feel good, within the time you’ve booked.
          </p>
        </div>
        <div className="service-cards">
          <article>
            <span className="service-number">01 / EVERY WEEK</span>
            <h3>
              Keep life
              <br />
              feeling lighter.
            </h3>
            <p>
              Consistent upkeep for busy homes, families and anyone who likes a
              fresh start to the week.
            </p>
            <div className="service-price">
              £18 <span>/ hour with your products</span>
            </div>
            <small>
              £22 / hour with our products & cloths · 3-hour minimum
            </small>
            <Link className="text-link" href="/pricing/">
              Weekly cleaning details <ArrowUpRight size={18} />
            </Link>
          </article>
          <article className="service-card-pink">
            <span className="service-number">02 / EVERY FORTNIGHT</span>
            <h3>
              A helping hand,
              <br />
              every other week.
            </h3>
            <p>
              Regular care with a little room between visits, for homes that
              manage light upkeep in between.
            </p>
            <div className="service-price">
              £19 <span>/ hour with your products</span>
            </div>
            <small>
              £23 / hour with our products & cloths · 3-hour minimum
            </small>
            <Link className="text-link" href="/pricing/">
              Fortnightly cleaning details <ArrowUpRight size={18} />
            </Link>
          </article>
        </div>
        <p className="section-footnote">
          For both options, please provide a safe vacuum cleaner and a suitable
          mop. Availability depends on the local diary.
        </p>
      </section>
      <RoomExperience />
      <section className="section steps-section">
        <p className="eyebrow">Simple from the first hello</p>
        <h2>
          Let’s make room
          <br />
          for a better routine.
        </h2>
        <div className="steps-grid">
          {[
            [
              "Tell us about your home",
              "Your postcode, rooms, preferred days and the things you’d love a hand with.",
            ],
            [
              "Find your regular slot",
              "We check the local diary, recommend a visit length and agree your price.",
            ],
            [
              "Meet your cleaner",
              "Show us around, agree priorities and begin a weekly or fortnightly routine.",
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
      <section className="section local-section">
        <div className="local-photo">
          <Image
            src="/images/bathroom.webp"
            alt="A clean bathroom with a walk-in shower, from the existing Cleaning Maidstone website"
            fill
            sizes="(max-width:760px) 100vw, 42vw"
          />
        </div>
        <div>
          <p className="eyebrow">Around the corner, not a call centre</p>
          <h2>
            A local service.
            <br />A personal touch.
          </h2>
          <p>
            We focus on dependable regular cleaning, clear communication and
            learning how you like your home cared for.
          </p>
          <div className="area-list">
            {business.areas.map((area) => (
              <span key={area}>{area}</span>
            ))}
          </div>
          <p className="section-footnote">
            Selected surrounding neighbourhoods. Availability depends on the
            current route and diary.
          </p>
          <Link href="/about-us/" className="text-link">
            Get to know Cleaning Maidstone <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="section faq-section">
        <div>
          <p className="eyebrow">A few things you might be wondering</p>
          <h2>
            Good questions.
            <br />
            Clear answers.
          </h2>
          <Link href="/contact-us/" className="text-link">
            Ask us something else <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span>+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="booking-section section" id="book">
        <div>
          <p className="eyebrow">Make a little space for yourself</p>
          <h2>
            Your calmer home
            <br />
            starts here.
          </h2>
          <p>
            Tell us a little about your home. We’ll check availability, talk
            through the priorities and agree the details together.
          </p>
          <a href={"tel:" + business.tel} className="contact-large">
            {business.phone}
          </a>
          <a href={"mailto:" + business.email}>{business.email}</a>
          <small>{business.hours}</small>
        </div>
        <EnquiryForm demo={demoEnabled()} />
      </section>
    </main>
  );
}
