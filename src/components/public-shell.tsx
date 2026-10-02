import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Mail,
  MapPin,
  Menu,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { business } from "@/lib/business";
import { Button } from "./ui/button";
import { PublicTopBar } from "./public-top-bar";
const links = [
  ["/maidstone-domestic-cleaning/", "Domestic cleaning"],
  ["/about-us/", "About us"],
  ["/pricing/", "Prices"],
  ["/blog/", "Home journal"],
  ["/contact-us/", "Contact"],
] as const;
export function PublicHeader() {
  return (
    <>
      <PublicTopBar />
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Cleaning Maidstone home">
          <Image
            src="/images/logo.png"
            width={800}
            height={129}
            alt="Cleaning Maidstone"
            loading="eager"
            unoptimized
          />
        </Link>
        <nav aria-label="Main navigation">
          {links.map(([href, label]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        <Button asChild size="sm">
          <Link href="/#book">
            Check availability <ArrowUpRight size={16} />
          </Link>
        </Button>
        <details className="mobile-nav">
          <summary>
            <Menu size={22} />
            <span>Menu</span>
          </summary>
          <nav aria-label="Mobile navigation">
            {links.map(([href, label]) => (
              <Link href={href} key={href}>
                {label}
                <ArrowUpRight size={16} />
              </Link>
            ))}
            <Link href="/#book" className="mobile-book-link">
              Check cleaning availability <ArrowUpRight size={16} />
            </Link>
          </nav>
        </details>
      </header>
    </>
  );
}
export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-message">
          <Sparkles size={30} />
          <p className="eyebrow">Less housework. More home.</p>
          <h2>
            Your time is precious.
            <br />
            <em>Let’s give some back.</em>
          </h2>
          <Button asChild>
            <Link href="/#book">
              Find your regular cleaner <ArrowUpRight size={18} />
            </Link>
          </Button>
        </div>
        <div className="footer-links">
          <p className="footer-label">A little help, close to home</p>
          {links.map(([href, label]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </div>
        <div className="footer-contact">
          <p className="footer-label">Let’s talk about your home</p>
          <a className="footer-phone" href={"tel:" + business.tel}>
            {business.phone}
          </a>
          <a href={"mailto:" + business.email}>
            <Mail size={16} />
            {business.email}
          </a>
          <a href={business.whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} />
            Chat on WhatsApp
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <p>
            <MapPin size={16} />
            Maidstone & surrounding neighbourhoods
          </p>
          <span>
            {business.hours}
            <br />
            Saturday & Sunday closed
          </span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Cleaning Maidstone</span>
        <span>Regular domestic cleaning. A personal approach.</span>
        <nav aria-label="Footer navigation">
          <Link href="/privacy/">Privacy</Link>
          <Link href="/login/">Staff sign in</Link>
        </nav>
      </div>
    </footer>
  );
}
