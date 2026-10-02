import type { Metadata } from "next";
import { business } from "./business";
export function metadata(
  title: string,
  description: string,
  path = "/",
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      locale: "en_GB",
      siteName: business.name,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Cleaning Maidstone — weekly and fortnightly domestic cleaning",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}
export function businessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": business.url + "/#business",
    name: business.name,
    url: business.url,
    telephone: business.tel,
    email: business.email,
    sameAs: Object.values(business.socials),
    areaServed: business.areas.map((name) => ({ "@type": "Place", name })),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:00",
        closes: "20:00",
      },
    ],
  };
}
export function breadcrumbs(title: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: business.url + "/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: title,
        item: business.url + path,
      },
    ],
  };
}
