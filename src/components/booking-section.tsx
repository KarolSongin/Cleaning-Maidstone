import { Phone, Mail, Check, ArrowUpRight, MessageCircle } from "lucide-react";
import { business } from "@/lib/business";
import { demoEnabled } from "@/lib/local-db";
import { EnquiryForm } from "./enquiry-form";
export function BookingSection() {
  return (
    <section className="booking-section section" id="book">
      <div className="booking-copy">
        <p className="eyebrow">Your home. Your routine. Your first step.</p>
        <h2>
          Let’s find your
          <br />
          <em>regular cleaner.</em>
        </h2>
        <p>
          Looking for weekly or fortnightly domestic cleaning in Maidstone? Tell
          us about your home and suitable days. We’ll check availability,
          recommend the time needed and agree the price with you.
        </p>
        <ul className="booking-promises">
          <li>
            <Check size={17} />
            Your priorities, discussed first
          </li>
          <li>
            <Check size={17} />
            Clear hourly prices
          </li>
          <li>
            <Check size={17} />
            Details agreed before your first clean
          </li>
        </ul>
        <div className="booking-contact">
          <a href={"tel:" + business.tel}>
            <span>
              <Phone size={19} />
            </span>
            <div>
              <small>Call us for a chat</small>
              <strong>{business.phone}</strong>
            </div>
            <ArrowUpRight size={20} />
          </a>
          <a href={"mailto:" + business.email}>
            <Mail size={17} />
            {business.email}
          </a>
          <small>{business.hours}</small>
          <a
            className="booking-whatsapp"
            href={business.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={17} />
            Chat on WhatsApp
            <ArrowUpRight size={15} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
      <div className="booking-form-wrap">
        <div className="booking-form-heading">
          <span className="eyebrow">Start with a few details</span>
          <span>We’ll take it from here.</span>
        </div>
        <EnquiryForm demo={demoEnabled()} />
      </div>
    </section>
  );
}
