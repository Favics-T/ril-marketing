"use client";

import { useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  Unlink,
} from "lucide-react";

/**
 * Formatted text editor that reads and writes Markdown. The Markdown is
 * submitted through a hidden input named `name`, so it drops into an
 * ordinary server-action form like a textarea. Only formatting the public
 * renderer (PageCopy) supports is offered: H2/H3, bold, italic, lists,
 * quotes and links.
 */
export function RichTextEditor({
  name,
  defaultValue = "",
  maxLength,
  placeholder,
  label,
}: {
  name: string;
  defaultValue?: string;
  maxLength: number;
  placeholder?: string;
  /** Accessible name for the editing area. */
  label: string;
}) {
  const [markdown, setMarkdown] = useState(defaultValue);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        underline: false,
        strike: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Markdown,
    ],
    content: defaultValue,
    contentType: "markdown",
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        class:
          "rich-text min-h-48 px-3 py-2.5 text-sm leading-6 outline-none [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
      },
    },
    onUpdate: ({ editor }) => setMarkdown(editor.isEmpty ? "" : editor.getMarkdown()),
  });

  const over = markdown.length > maxLength;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
        {editor ? <Toolbar editor={editor} /> : <div className="h-10 border-b border-border" aria-hidden />}
        <EditorContent editor={editor} />
      </div>
      <input type="hidden" name={name} value={markdown} />
      <p className={`text-xs tabular-nums ${over ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
        {markdown.length.toLocaleString()}/{maxLength.toLocaleString()} characters, including formatting
        {over ? ". Shorten the copy before saving." : ""}
      </p>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const openLink = () => {
    setHref((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  };
  const applyLink = () => {
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (!url) chain.unsetLink().run();
    else chain.setLink({ href: /^(https?:|mailto:)/i.test(url) ? url : `https://${url}` }).run();
    setLinkOpen(false);
  };

  return (
    <div className="border-b border-border bg-muted/40">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 p-1">
        <Tool label="Heading" pressed={active.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></Tool>
        <Tool label="Subheading" pressed={active.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 /></Tool>
        <Divider />
        <Tool label="Bold" pressed={active.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></Tool>
        <Tool label="Italic" pressed={active.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></Tool>
        <Tool label={active.link ? "Edit link" : "Add link"} pressed={active.link || linkOpen} onClick={openLink}><Link2 /></Tool>
        {active.link ? <Tool label="Remove link" onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}><Unlink /></Tool> : null}
        <Divider />
        <Tool label="Bulleted list" pressed={active.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></Tool>
        <Tool label="Numbered list" pressed={active.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></Tool>
        <Tool label="Quote" pressed={active.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></Tool>
        <Divider />
        <Tool label="Undo" disabled={!active.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 /></Tool>
        <Tool label="Redo" disabled={!active.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 /></Tool>
      </div>
      {linkOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border p-2">
          <input
            type="url"
            autoFocus
            value={href}
            onChange={(event) => setHref(event.target.value)}
            onKeyDown={(event) => {
              // Enter must not submit the surrounding form.
              if (event.key === "Enter") { event.preventDefault(); applyLink(); }
              if (event.key === "Escape") { event.preventDefault(); setLinkOpen(false); editor.commands.focus(); }
            }}
            placeholder="https://…"
            aria-label="Link address"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          />
          <button type="button" onClick={applyLink} className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Apply</button>
          <button type="button" onClick={() => setLinkOpen(false)} className="h-8 rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      ) : null}
    </div>
  );
}

function Tool({ label, pressed, disabled, onClick, children }: { label: string; pressed?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground disabled:pointer-events-none disabled:opacity-40 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}
