import { notFound } from "next/navigation";
import Link from "next/link";
import { publicContent } from "@/lib/repository";
import { metadata } from "@/lib/seo";
import { business } from "@/lib/business";
import { ContentBody } from "@/components/content-renderer";
import { JsonLd } from "@/components/json-ld";
import { londonDate } from "@/lib/scheduling";
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
      <article className="section narrow article-page">
        <Link href="/blog/" className="breadcrumb">
          ← Back to the journal
        </Link>
        <p className="eyebrow">
          {post.category} · {post.published_at && londonDate(post.published_at)}
        </p>
        <h1>{post.title}</h1>
        <p className="article-excerpt">{post.excerpt}</p>
        <p className="article-author">By {post.author || business.name}</p>
        <ContentBody content={post} />
        <Link href="/maidstone-domestic-cleaning/" className="text-link">
          Explore our regular cleaning ↗
        </Link>
      </article>
    </main>
  );
}
