"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-display mt-10 mb-4 text-2xl font-black tracking-tight text-foreground first:mt-0 md:text-3xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-display mt-8 mb-3 text-xl font-bold tracking-tight text-foreground first:mt-0 md:text-2xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display mt-6 mb-2 text-lg font-bold text-foreground">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="my-4 leading-7 text-muted-foreground first:mt-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-4 ml-5 list-disc space-y-1.5 text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 ml-5 list-decimal space-y-1.5 text-muted-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-5 border-l-4 border-primary/50 bg-muted/40 py-3 pl-4 pr-3 text-sm italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block w-full overflow-x-auto rounded-md bg-muted px-4 py-3 font-mono text-sm text-foreground">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-5 overflow-hidden rounded-lg border border-border/40 bg-muted">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-8 border-border/40" />,
  table: ({ children }) => (
    <div className="my-5 w-full overflow-x-auto rounded-lg border border-border/40">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border/40 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
      {children}
    </thead>
  ),
  tbody: ({ children }) => (
    <tbody className="divide-y divide-border/30">{children}</tbody>
  ),
  tr: ({ children }) => <tr className="transition-colors hover:bg-muted/30">{children}</tr>,
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 text-muted-foreground">{children}</td>
  ),
};

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose-blog">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
