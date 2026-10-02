import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Phone, Mail, MapPin } from "lucide-react";
import { business } from "@/lib/business";
import { Button } from "./ui/button";
export function PublicHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Cleaning Maidstone home">
        <Image
          src="/images/logo.png"
          width={795}
          height={128}
          alt="Cleaning Maidstone"
          sizes="(max-width: 760px) 220px, 285px"
          priority
        />
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/maidstone-domestic-cleaning/">Our cleaning</Link>
        <Link href="/about-us/">About us</Link>
        <Link href="/pricing/">Pricing</Link>
        <Link href="/blog/">Journal</Link>
      </nav>
      <Button asChild size="sm">
        <Link href="/#book">
          Check availability <ArrowUpRight size={16} />
        </Link>
      </Button>
      <details className="mobile-nav">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          <Link href="/maidstone-domestic-cleaning/">Our cleaning</Link>
          <Link href="/about-us/">About us</Link>
          <Link href="/pricing/">Pricing</Link>
          <Link href="/blog/">Journal</Link>
          <Link href="/contact-us/">Contact us</Link>
        </nav>
      </details>
    </header>
  );
}
export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <p className="eyebrow">A little more time for you</p>
          <h2>
            Come home
            <br />
            to a calmer space.
          </h2>
          <Link href="/#book" className="text-link">
            Let’s find your regular slot <ArrowUpRight size={20} />
          </Link>
        </div>
        <div className="footer-contact">
          <a href={"tel:" + business.tel}>
            <Phone size={18} />
            {business.phone}
          </a>
          <a href={"mailto:" + business.email}>
            <Mail size={18} />
            {business.email}
          </a>
          <p>
            <MapPin size={18} />
            Maidstone & selected surrounding areas
          </p>
          <span>{business.hours}</span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Cleaning Maidstone</span>
        <nav aria-label="Footer navigation">
          <Link href="/contact-us/">Contact</Link>
          <Link href="/about-us/">About</Link>
          <Link href="/pricing/">Pricing</Link>
          <Link href="/privacy/">Privacy</Link>
          <Link href="/login/">Staff sign in</Link>
        </nav>
      </div>
    </footer>
  );
}
