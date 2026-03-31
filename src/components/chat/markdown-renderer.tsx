"use client";

import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-chat-assistant-foreground mb-4 last:mb-0">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/80">{children}</em>
          ),
          hr: () => (
            <hr className="my-4 border-border" />
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-accent underline underline-offset-2 hover:text-accent/80" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-base font-semibold text-foreground mt-4 mb-2">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h4>
          ),
          ul: ({ children }) => (
            <ul className="text-sm text-foreground/80 list-disc pl-5 mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="text-sm text-foreground/80 list-decimal pl-5 mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/50 pl-4 my-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-foreground/80">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
