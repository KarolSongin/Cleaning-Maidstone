import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { publishedContent } from "@/lib/repository";
import { metadata } from "@/lib/seo";
import { londonDate } from "@/lib/scheduling";
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
      <section className="section page-intro">
        <p className="eyebrow">The Cleaning Maidstone journal</p>
        <h1>
          Practical advice for
          <br />a cleaner home.
        </h1>
        <p>
          Everyday cleaning advice, useful routines and ideas to help you get
          more from your regular domestic clean.
        </p>
      </section>
      <section className="section blog-grid">
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
      </section>
    </main>
  );
}
