import { ArrowUpRight, Star } from "lucide-react";
import { business } from "@/lib/business";

export function GoogleRating() {
  const rating = business.googleReviews.rating.toFixed(1);
  const content = (
    <>
      <svg
        className="google-mark"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.73-.06-1.42-.19-2.09H12v3.96h5.92a5.07 5.07 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.75 3.28-7.95Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.8l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.17v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 13.97A6.6 6.6 0 0 1 5.5 12c0-.68.12-1.34.34-1.97V7.19H2.17A11 11 0 0 0 1 12c0 1.78.43 3.46 1.17 4.81l3.67-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.5c1.62 0 3.06.56 4.21 1.64l3.16-3.16C17.46 2.2 14.97 1 12 1a11 11 0 0 0-9.83 6.19l3.67 2.84C6.71 7.43 9.14 5.5 12 5.5Z"
        />
      </svg>
      <span className="rating-stars" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((star) => (
          <Star size={14} strokeWidth={1.3} key={star} />
        ))}
      </span>
      <span className="rating-label">
        <strong>{rating}</strong>
        {" on Google"}
      </span>
    </>
  );
  return business.googleReviews.url ? (
    <a
      className="hero-google-rating"
      href={business.googleReviews.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${rating} on Google, rated ${rating} out of 5. Read our reviews (opens in a new tab)`}
    >
      {content}
      <ArrowUpRight size={12} aria-hidden="true" />
    </a>
  ) : (
    <div
      className="hero-google-rating"
      role="img"
      aria-label={`${rating} on Google, rated ${rating} out of 5`}
    >
      {content}
    </div>
  );
}
