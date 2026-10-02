import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  HeartHandshake,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Button } from "./ui/button";

type Action = { href: string; label: string };
export type PublicPageHeroProps = {
  eyebrow: string;
  heading: ReactNode;
  description: string;
  tagline?: string;
  image: { src: string; alt: string; unoptimized?: boolean };
  primaryAction: Action;
  secondaryAction?: Action;
  note?: string;
  detail: { title: string; text: string; icon?: ReactNode };
  caption: string;
  stamp?: ReactNode;
};

export function PublicPageHero({
  eyebrow,
  heading,
  description,
  tagline,
  image,
  primaryAction,
  secondaryAction,
  note,
  detail,
  caption,
  stamp,
}: PublicPageHeroProps) {
  return (
    <section className="hero page-hero">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          {eyebrow}
        </p>
        <h1>{heading}</h1>
        {tagline && <p className="hero-tagline">{tagline}</p>}
        <p className="hero-description">{description}</p>
        <div className="hero-actions">
          <Button asChild>
            <Link href={primaryAction.href}>
              {primaryAction.label}
              <ArrowUpRight size={19} />
            </Link>
          </Button>
          {secondaryAction && (
            <Link href={secondaryAction.href} className="text-link">
              {secondaryAction.label}
              <ArrowRight size={17} />
            </Link>
          )}
        </div>
        {note && (
          <div className="hero-note">
            <span className="mini-check">
              <Check size={12} />
            </span>
            {note}
          </div>
        )}
      </div>
      <div className="hero-visual">
        <div className="hero-photo">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 760px) calc(100vw - 74px), (max-width: 1100px) calc(52.5vw - 71px), (max-width: 1440px) calc(52.5vw - 92px), 655px"
            loading="eager"
            fetchPriority="high"
            unoptimized={image.unoptimized}
          />
          <div className="photo-caption">
            <MapPin size={15} />
            {caption}
          </div>
        </div>
        <div className="hero-care-card">
          <span className="care-icon">
            {detail.icon || <HeartHandshake size={25} />}
          </span>
          <div>
            <strong>{detail.title}</strong>
            <span>{detail.text}</span>
          </div>
        </div>
        {stamp && (
          <div className="hero-stamp" aria-hidden="true">
            <Sparkles size={25} />
            <span>{stamp}</span>
          </div>
        )}
      </div>
    </section>
  );
}
