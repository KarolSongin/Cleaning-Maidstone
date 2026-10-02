import { PublicHeader, PublicFooter } from "@/components/public-shell";
import localFont from "next/font/local";
import "../public.css";
const bodyFont = localFont({
  src: "../fonts/dm-sans.woff2",
  variable: "--font-public-body",
  weight: "400 700",
  display: "swap",
});
const accentFont = localFont({
  src: "../fonts/dm-serif-italic.woff2",
  variable: "--font-public-accent",
  weight: "400",
  style: "italic",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
});
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`public-site ${bodyFont.variable} ${accentFont.variable}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
