"use client";

import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm prose-neutral max-w-none">
      <ReactMarkdown
        components={{
          // Párrafos con espaciado elegante
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-neutral-800 mb-4 last:mb-0">
              {children}
            </p>
          ),
          // Negritas
          strong: ({ children }) => (
            <strong className="font-semibold text-neutral-900">{children}</strong>
          ),
          // Cursivas
          em: ({ children }) => (
            <em className="italic text-neutral-700">{children}</em>
          ),
          // Línea horizontal (separador de fuentes)
          hr: () => (
            <hr className="my-4 border-neutral-200" />
          ),
          // Links
          a: ({ href, children }) => (
            <a href={href} className="text-neutral-600 underline underline-offset-2 hover:text-neutral-900" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // Headers (por si acaso Claude los usa)
          h1: ({ children }) => (
            <h3 className="text-base font-semibold text-neutral-900 mt-4 mb-2">{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-base font-semibold text-neutral-900 mt-4 mb-2">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-sm font-semibold text-neutral-900 mt-3 mb-1">{children}</h4>
          ),
          // Listas (por si acaso)
          ul: ({ children }) => (
            <ul className="text-sm text-neutral-700 list-disc pl-5 mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="text-sm text-neutral-700 list-decimal pl-5 mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed">{children}</li>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-neutral-300 pl-4 my-3 italic text-neutral-600">
              {children}
            </blockquote>
          ),
          // Código inline
          code: ({ children }) => (
            <code className="text-xs bg-neutral-100 px-1.5 py-0.5 rounded font-mono text-neutral-700">
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
