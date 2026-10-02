import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { publishedContent } from "@/lib/repository";
import { metadata } from "@/lib/seo";
import { londonDate } from "@/lib/scheduling";
import { PublicPageHero } from "@/components/public-page-hero";
export const dynamic = "force-dynamic";
export const generateMetadata = () =>
  metadata(
    "House Cleaning Advice & Home Journal | Cleaning Maidstone",
    "Practical house-cleaning advice, preparing for a regular cleaner and making the most of weekly or fortnightly domestic cleaning.",
    "/blog/",
  );
export default async function Blog() {
  const posts = (await publishedContent()).filter((p) => p.kind === "blog");
  return (
    <main id="main">
      <PublicPageHero
        eyebrow="The Cleaning Maidstone journal"
        heading={
          <>
            Practical advice for <br />
            <em>a cleaner home.</em>
          </>
        }
        tagline="Little ideas. More everyday ease."
        description="Everyday cleaning advice, useful routines and ideas to help you get more from your regular domestic clean."
        image={{
          src: "/images/home-detail.webp",
          alt: "A light-filled living and dining space opening onto a garden",
        }}
        primaryAction={{
          href: "#journal-articles",
          label: "Explore the journal",
        }}
        secondaryAction={{
          href: "/maidstone-domestic-cleaning/",
          label: "Our regular cleaning",
        }}
        detail={{
          title: "Made for everyday life.",
          text: "Practical advice for the home you live in.",
          icon: <BookOpen size={25} />,
        }}
        caption="Cleaning Maidstone · At home"
        stamp={
          <>
            Small changes.
            <br />A fresher home.
          </>
        }
      />
      <section className="section journal-section" id="journal-articles">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ideas to bring home</p>
            <h2>
              The latest from <br />
              <em>the journal.</em>
            </h2>
          </div>
          <p>
            A little preparation and a useful routine can make your regular
            cleaning visit work better for your home.
          </p>
        </div>
        <div className="blog-grid">
          {posts.length ? (
            posts.map((post) => (
              <Link
                className="blog-card"
                key={post.id}
                href={"/blog/" + post.slug + "/"}
              >
                <div className="blog-card-photo">
                  <Image
                    src={post.image_path || "/images/home-detail.webp"}
                    alt={
                      post.image_alt || "A light-filled living and dining space"
                    }
                    fill
                    sizes="(max-width:760px) 100vw, 33vw"
                    unoptimized={!!post.image_path}
                  />
                </div>
                <div className="blog-card-body">
                  <span>
                    {post.category || "At home"} ·{" "}
                    {post.published_at && londonDate(post.published_at)}
                  </span>
                  <h2>{post.title}</h2>
                  <p>{post.excerpt}</p>
                  <span className="text-link">
                    Read the article <ArrowUpRight size={17} />
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <p>New articles are on their way.</p>
          )}
        </div>
      </section>
    </main>
  );
}
