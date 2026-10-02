import type { ReactNode } from "react";
import Image from "next/image";
import type { Content } from "@/lib/models";
type Node = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
};
function render(node: Node, key: number | string, depth = 0): ReactNode {
  if (depth > 30) return null;
  if (node.type === "text") {
    let text: ReactNode = node.text ?? "";
    for (const m of node.marks ?? []) {
      if (m.type === "bold") text = <strong key={key}>{text}</strong>;
      if (m.type === "italic") text = <em key={key}>{text}</em>;
      if (
        m.type === "link" &&
        typeof m.attrs?.href === "string" &&
        /^(https?:\/\/|\/(?!\/))/.test(m.attrs.href)
      )
        text = (
          <a key={key} href={m.attrs.href} rel="noopener noreferrer">
            {text}
          </a>
        );
    }
    return text;
  }
  const children = node.content?.map((n, i) =>
    render(n, `${key}-${i}`, depth + 1),
  );
  switch (node.type) {
    case "doc":
      return <div key={key}>{children}</div>;
    case "heading":
      return node.attrs?.level === 3 ? (
        <h3 key={key}>{children}</h3>
      ) : (
        <h2 key={key}>{children}</h2>
      );
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return <ol key={key}>{children}</ol>;
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "hardBreak":
      return <br key={key} />;
    default:
      return <span key={key}>{children}</span>;
  }
}
export function ContentBody({ content }: { content: Content }) {
  return (
    <div className="prose">
      {content.image_path && (
        <Image
          src={content.image_path}
          alt={content.image_alt}
          width={1000}
          height={650}
          unoptimized
        />
      )}
      {render(content.body, 0)}
      {content.sections.map((s, i) => (
        <section key={i}>
          <h2>{s.heading}</h2>
          <p>{s.text}</p>
        </section>
      ))}
    </div>
  );
}
