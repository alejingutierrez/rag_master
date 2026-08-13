import type { ReactNode } from "react";
import "@/components/public/section-masthead.css";

export function SectionMasthead({
  eyebrow,
  title,
  summary,
  meta,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="section-masthead" aria-labelledby="section-masthead-title">
      <header className="section-masthead-row">
        <div className="section-masthead-identity">
          <span>{eyebrow}</span>
          <h1 id="section-masthead-title">{title}</h1>
        </div>
        <p className="section-masthead-summary">{summary}</p>
        {(actions || meta) ? (
          <div className="section-masthead-utility">
            {actions}
            {meta ? <div className="section-masthead-meta">{meta}</div> : null}
          </div>
        ) : null}
      </header>
      {children ? <div className="section-masthead-periods">{children}</div> : null}
    </section>
  );
}
