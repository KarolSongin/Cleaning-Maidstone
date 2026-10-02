import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://cleaningmaidstone.co.uk",
  ),
  title: {
    default: "Cleaning Maidstone | A calmer home, every week",
    template: "%s",
  },
  icons: { icon: "/images/favicon.png" },
  description:
    "Local weekly and fortnightly domestic cleaning in Maidstone. Familiar cleaners, agreed priorities and clear hourly prices.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
