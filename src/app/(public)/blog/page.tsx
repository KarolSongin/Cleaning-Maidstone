import Link from "next/link";
import { publishedContent } from "@/lib/repository";
import { metadata } from "@/lib/seo";
import { londonDate } from "@/lib/scheduling";
export const dynamic = "force-dynamic";
export const generateMetadata = () =>
  metadata(
    "The journal | Cleaning Maidstone",
    "Practical thoughts on a calmer home and making the most of regular domestic cleaning.",
    "/blog/",
  );
export default async function Blog() {
  const posts = (await publishedContent()).filter((p) => p.kind === "blog");
  return (
    <main id="main">
      <section className="section page-intro">
        <p className="eyebrow">The Cleaning Maidstone journal</p>
        <h1>
          A little inspiration
          <br />
          for life at home.
        </h1>
        <p>
          Practical ideas, everyday routines and a calmer approach to keeping
          your home.
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
              <span>
                {post.category || "At home"} ·{" "}
                {post.published_at && londonDate(post.published_at)}
              </span>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
              <span className="text-link">Read the story ↗</span>
            </Link>
          ))
        ) : (
          <p>New articles are on their way.</p>
        )}
      </section>
    </main>
  );
}
