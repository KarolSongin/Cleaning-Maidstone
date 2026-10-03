"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import type { Content } from "@/lib/models";
import { Button } from "./ui/button";
import { Field, useConfirmedOperation } from "./operation-form";
import { useAdminConfirmation } from "./admin-confirmation";
import { ActionCancelled } from "@/lib/admin-confirmation";
export default function ContentEditor({
  content,
  onSaved,
}: {
  content?: Content;
  onSaved: () => Promise<void>;
}) {
  const sendOperation = useConfirmedOperation();
  const confirm = useAdminConfirmation();
  const editor = useEditor({
    extensions: [StarterKit],
    content: content?.body || { type: "doc", content: [{ type: "paragraph" }] },
    immediatelyRender: false,
  });
  const [sections, setSections] = useState(content?.sections ?? []);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState(content?.image_path ?? "");
  return (
    <form
      className="ops-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = new FormData(
          e.currentTarget,
          (e.nativeEvent as SubmitEvent).submitter,
        );
        const status = form.get("intent") || "draft";
        setBusy(true);
        setError("");
        setSuccess("");
        try {
          await sendOperation(
            "content",
            {
              ...(content ? { id: content.id } : {}),
              kind: form.get("kind"),
              slug: form.get("slug"),
              title: form.get("title"),
              excerpt: form.get("excerpt"),
              seo_title: form.get("seo_title"),
              seo_description: form.get("seo_description"),
              author: form.get("author"),
              category: form.get("category"),
              image_path: image,
              image_alt: form.get("image_alt"),
              body: editor?.getJSON() || {},
              sections,
              status,
              published_at: form.get("published_at")
                ? new Date(
                    String(form.get("published_at")) + "T12:00:00Z",
                  ).toISOString()
                : "",
            },
            content?.status === "published" && status === "draft"
              ? {
                  title: "Unpublish this content?",
                  description: `Remove “${form.get("title")}” from the public website and save these changes as a private draft.`,
                  confirmLabel: "Unpublish",
                  danger: true,
                }
              : undefined,
          );
          setSuccess(
            status === "published"
              ? "Published. The public page and sitemap have been refreshed."
              : "Saved as a draft. This version is inaccessible to public visitors.",
          );
          await onSaved();
        } catch (err) {
          if (!(err instanceof ActionCancelled))
            setError(err instanceof Error ? err.message : "Save failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <label>
          Content type
          <select
            name="kind"
            defaultValue={content?.kind || "blog"}
            disabled={!!content}
          >
            <option value="blog">Blog article</option>
            <option value="page">Landing page</option>
          </select>
          {content && <input type="hidden" name="kind" value={content.kind} />}
        </label>
        <Field name="slug" label="URL slug" value={content?.slug} required />
      </div>
      <Field name="title" label="Title" value={content?.title} required />
      <label>
        Introduction
        <textarea
          name="excerpt"
          defaultValue={content?.excerpt}
          maxLength={500}
        />
      </label>
      <div className="editor-toolbar" role="group" aria-label="Text formatting">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          Italic
        </button>
        <button
          type="button"
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          Heading
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          List
        </button>
      </div>
      <EditorContent editor={editor} />
      <h3>Structured sections</h3>
      {sections.map((s, i) => (
        <div key={i} className="panel">
          <label>
            Heading
            <input
              value={s.heading}
              onChange={(e) =>
                setSections(
                  sections.map((item, j) =>
                    j === i ? { ...item, heading: e.target.value } : item,
                  ),
                )
              }
            />
          </label>
          <label>
            Text
            <textarea
              value={s.text}
              onChange={(e) =>
                setSections(
                  sections.map((item, j) =>
                    j === i ? { ...item, text: e.target.value } : item,
                  ),
                )
              }
            />
          </label>
          <button
            type="button"
            className="button button-ghost button-sm"
            onClick={async () => {
              if (
                await confirm?.({
                  title: "Remove this section?",
                  description: `Remove “${sections[i].heading || "this section"}” from the content. The change takes effect when you save.`,
                  confirmLabel: "Remove section",
                  danger: true,
                })
              )
                setSections((current) => current.filter((_, j) => j !== i));
            }}
          >
            Remove section
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setSections([...sections, { heading: "", text: "" }])}
      >
        Add a section
      </Button>
      <div className="form-grid">
        <Field
          name="seo_title"
          label="SEO title (up to 70 characters)"
          value={content?.seo_title}
        />
        <Field
          name="seo_description"
          label="SEO description (up to 170 characters)"
          value={content?.seo_description}
        />
        <Field
          name="author"
          label="Author"
          value={content?.author || "Cleaning Maidstone"}
        />
        <Field
          name="category"
          label="Category"
          value={content?.category || "At home"}
        />
        <Field
          name="published_at"
          label="Publication date"
          type="date"
          value={content?.published_at?.slice(0, 10)}
        />
        <Field
          name="image_alt"
          label="Image description"
          value={content?.image_alt}
        />
      </div>
      <label>
        Public article or landing-page image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = e.target.files?.[0];
            if (!file) return;
            if (
              !(await confirm?.({
                title: "Upload this image?",
                description: `Add “${file.name}” to the website media library and select it for this content. It will appear publicly after you publish the content.`,
                confirmLabel: "Upload image",
              }))
            ) {
              input.value = "";
              return;
            }
            setError("");
            const f = new FormData();
            f.set("file", file);
            try {
              const r = await fetch("/api/media/", { method: "POST", body: f });
              const body = await r.json();
              if (!r.ok) throw new Error(body.error);
              setImage(body.url);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Upload failed");
            }
          }}
        />
      </label>
      {image && (
        <p className="form-small">
          Image uploaded.{" "}
          <button
            className="text-link"
            type="button"
            onClick={async () => {
              if (
                await confirm?.({
                  title: "Remove this image?",
                  description:
                    "Remove the selected image from this content. The change takes effect when you save; the image stays in the media library.",
                  confirmLabel: "Remove image",
                  danger: true,
                })
              )
                setImage("");
            }}
          >
            Remove
          </button>
        </p>
      )}
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="alert" role="status">
          {success}
        </p>
      )}
      <p className="form-small">
        Saving an existing published page as a draft unpublishes it. Built-in
        service pages retain their verified base copy. Slugs for staff, API and
        authentication routes are reserved.
      </p>
      <div className="inline-actions">
        <Button
          type="submit"
          name="intent"
          value="draft"
          variant="outline"
          disabled={busy}
        >
          Save draft / unpublish
        </Button>
        <Button type="submit" name="intent" value="published" disabled={busy}>
          Publish
        </Button>
      </div>
      {content && (
        <a
          className="preview-link"
          href={"/preview/" + content.id + "/"}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open authenticated preview ↗
        </a>
      )}
    </form>
  );
}
