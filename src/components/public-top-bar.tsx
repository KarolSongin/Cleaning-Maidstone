"use client";

import { useState } from "react";
import {
  Facebook,
  Instagram,
  MapPin,
  Pause,
  Phone,
  Play,
  Sparkles,
} from "lucide-react";
import { business, publicQuote } from "@/lib/business";

export function PublicTopBar() {
  const [paused, setPaused] = useState(false);
  return (
    <div className="utility-bar">
      <span className="utility-location">
        <MapPin size={13} aria-hidden="true" /> Local care for Maidstone homes
      </span>
      <div className="utility-quote" data-paused={paused}>
        <span className="sr-only">{publicQuote}</span>
        <div className="quote-window" aria-hidden="true">
          <div className="quote-track">
            {[0, 1].map((group) => (
              <div className="quote-group" key={group}>
                {[0, 1, 2].map((copy) => (
                  <span className="quote-item" key={copy}>
                    <span>“{publicQuote}”</span>
                    <Sparkles size={14} />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="quote-toggle"
          onClick={() => setPaused((value) => !value)}
          aria-label={
            paused ? "Resume scrolling quote" : "Pause scrolling quote"
          }
          title={paused ? "Resume scrolling quote" : "Pause scrolling quote"}
        >
          {paused ? (
            <Play size={12} aria-hidden="true" />
          ) : (
            <Pause size={12} aria-hidden="true" />
          )}
        </button>
      </div>
      <nav className="utility-socials" aria-label="Social media">
        <a
          href={business.socials.facebook}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Cleaning Maidstone on Facebook (opens in a new tab)"
          title="Facebook"
        >
          <Facebook size={15} aria-hidden="true" />
        </a>
        <a
          href={business.socials.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Cleaning Maidstone on Instagram (opens in a new tab)"
          title="Instagram"
        >
          <Instagram size={15} aria-hidden="true" />
        </a>
        <a
          href={business.socials.x}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Cleaning Maidstone on X (opens in a new tab)"
          title="X"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.29 19.49h2.039L6.487 3.24H4.3l13.31 17.403Z" />
          </svg>
        </a>
      </nav>
      <a className="utility-phone" href={"tel:" + business.tel}>
        <Phone size={13} aria-hidden="true" /> {business.phone}
      </a>
    </div>
  );
}
