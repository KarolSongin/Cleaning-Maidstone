import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { rows } from "@/lib/repository";
import type { Content } from "@/lib/models";
import { ContentBody } from "@/components/content-renderer";
export const metadata = {
  title: "Private content preview",
  robots: { index: false, follow: false },
};
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor("admin");
  const { id } = await params;
  const content = (await rows<Content>("content", actor)).find(
    (c) => c.id === id,
  );
  if (!content) notFound();
  return (
    <main id="main">
      <div className="preview-banner">
        Private preview · {content.status} · visible only to an authenticated
        admin
      </div>
      <article className="section narrow article-page">
        <h1>{content.title}</h1>
        <p>{content.excerpt}</p>
        <ContentBody content={content} />
      </article>
    </main>
  );
}
