import { notFound } from "next/navigation";
import Link from "next/link";
import { publicContent } from "@/lib/repository";
import { metadata } from "@/lib/seo";
import { business } from "@/lib/business";
import { ContentBody } from "@/components/content-renderer";
import { JsonLd } from "@/components/json-ld";
import { londonDate } from "@/lib/scheduling";
import { PublicPageHero } from "@/components/public-page-hero";
import { BookOpen, ArrowRight } from "lucide-react";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const post = await publicContent("blog", (await params).slug);
  return post
    ? metadata(
        post.seo_title || post.title,
        post.seo_description || post.excerpt,
        "/blog/" + post.slug + "/",
      )
    : {};
}
export default async function Article({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const post = await publicContent("blog", (await params).slug);
  if (!post) notFound();
  return (
    <main id="main">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.excerpt,
          datePublished: post.published_at,
          dateModified: post.updated_at,
          author: {
            "@type": "Organization",
            name: post.author || business.name,
          },
          mainEntityOfPage: business.url + "/blog/" + post.slug + "/",
        }}
      />
      <PublicPageHero
        eyebrow={post.category || "The Cleaning Maidstone journal"}
        heading={post.title}
        description={post.excerpt}
        image={{
          src: post.image_path || "/images/living-room.webp",
          alt: post.image_path
            ? post.image_alt
            : "Sunlit living room with comfortable seating and leafy houseplants",
          unoptimized: !!post.image_path,
        }}
        primaryAction={{ href: "#article", label: "Read the article" }}
        secondaryAction={{ href: "/blog/", label: "All journal articles" }}
        detail={{
          title: "From " + (post.author || business.name),
          text: post.published_at
            ? londonDate(post.published_at)
            : "The home journal",
          icon: <BookOpen size={25} />,
        }}
        caption="The Cleaning Maidstone journal"
        stamp={
          <>
            A little help.
            <br />
            For your home.
          </>
        }
      />
      <article className="section narrow article-page" id="article">
        <ContentBody content={post} showImage={false} />
        <Link href="/maidstone-domestic-cleaning/" className="text-link">
          Explore our regular cleaning <ArrowRight size={17} />
        </Link>
      </article>
    </main>
  );
}
