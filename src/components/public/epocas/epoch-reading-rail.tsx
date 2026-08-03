"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import type { ProseHeading } from "@/components/public/prose";

function readingProgress(element: HTMLElement): number {
  const top = window.scrollY + element.getBoundingClientRect().top;
  const readable = Math.max(element.offsetHeight - window.innerHeight * 0.58, 1);
  return Math.min(100, Math.max(0, ((window.scrollY - top + 140) / readable) * 100));
}

export function EpochReadingRail({
  sections,
  variant = "desktop",
}: {
  sections: ProseHeading[];
  variant?: "desktop" | "mobile";
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>("[data-epoch-reader]");
    if (!article) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setProgress(readingProgress(article)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (!sections.length) return;
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element instanceof HTMLElement);
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-18% 0px -70% 0px", threshold: [0, 1] },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <aside
      className={`ea-reading-rail ea-reading-rail-${variant}`}
      aria-label="Guía de lectura"
    >
      <div className="ea-reading-rail-inner">
        <p className="ea-rail-label">Progreso de lectura</p>
        <strong>{Math.round(progress)}% completado</strong>
        <div className="ea-progress-track" aria-hidden>
          <i style={{ width: `${progress}%` }} />
        </div>

        {sections.length ? (
          <nav className="ea-chapters" aria-label="Capítulos del ensayo">
            <ol>
              {sections.map((section, index) => (
                <li
                  key={section.id}
                  className={`${section.level === 3 ? "is-subsection" : ""} ${
                    activeId === section.id ? "is-active" : ""
                  }`}
                >
                  <a href={`#${section.id}`} onClick={() => setActiveId(section.id)}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {section.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : (
          <p className="ea-rail-note">Una lectura continua, sin capítulos editoriales.</p>
        )}

        <button type="button" className="ea-print" onClick={() => window.print()}>
          <Printer aria-hidden />
          Imprimir ensayo
        </button>
      </div>
    </aside>
  );
}
