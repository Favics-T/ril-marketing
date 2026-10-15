import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";

/**
 * Renders landing page copy, stored as Markdown. Raw HTML is dropped and
 * unsafe link protocols are stripped by react-markdown, so copy can't
 * inject markup into the public page. remark-breaks keeps single line
 * breaks, so pages written as plain text before the rich editor look the same.
 */
const ALLOWED = ["p", "br", "strong", "em", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "a", "hr"];

const Heading = ({ children }: { children?: ReactNode }) => (
  <h2 className="mt-10 text-2xl font-bold leading-tight tracking-tight text-foreground first:mt-0 sm:text-3xl">{children}</h2>
);
const Subheading = ({ children }: { children?: ReactNode }) => (
  <h3 className="mt-8 text-xl font-semibold leading-snug text-foreground first:mt-0">{children}</h3>
);

const components: Components = {
  // The page headline is the only h1; other levels fold into the two the editor offers.
  h1: Heading,
  h2: Heading,
  h3: Subheading,
  h4: Subheading,
  h5: Subheading,
  h6: Subheading,
  p: ({ children }) => <p className="mt-5 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-5 list-disc space-y-2 pl-6 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-5 list-decimal space-y-2 pl-6 first:mt-0">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="mt-6 border-l-4 border-primary/60 pl-5 italic text-foreground first:mt-0">{children}</blockquote>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  hr: () => <hr className="my-8 border-border" />,
  // A link whose protocol was stripped as unsafe arrives with no href; show its text only.
  a: ({ href, children }) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4 hover:no-underline">
        {children}
      </a>
    ) : (
      <>{children}</>
    ),
};

export function PageCopy({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={className}>
      <Markdown remarkPlugins={[remarkBreaks]} allowedElements={ALLOWED} unwrapDisallowed skipHtml components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}
