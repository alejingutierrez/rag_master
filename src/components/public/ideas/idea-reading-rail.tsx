"use client";

import { useEffect, useRef, useState } from "react";

export interface IdeaRailItem {
  id: string;
  label: string;
}

function readingProgress(article: HTMLElement): number {
  const top = window.scrollY + article.getBoundingClientRect().top;
  const readable = Math.max(article.offsetHeight - window.innerHeight, 1);
  return Math.min(100, Math.max(0, ((window.scrollY - top) / readable) * 100));
}

export function IdeaReadingRail({
  items,
  variant = "desktop",
}: {
  items: IdeaRailItem[];
  variant?: "desktop" | "mobile";
}) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const article = document.querySelector<HTMLElement>("[data-idea-article]");
    if (!article) return;
    const update = () => {
      frame.current = null;
      setProgress(Math.round(readingProgress(article)));
    };
    const onScroll = () => {
      if (frame.current == null) frame.current = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame.current != null) window.cancelAnimationFrame(frame.current);
    };
  }, []);

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element instanceof HTMLElement);
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-18% 0px -70% 0px", threshold: [0, 1] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));
  const activeLabel = items[activeIndex]?.label ?? items[0]?.label ?? "En breve";

  if (variant === "mobile") {
    return (
      <aside className="id-reading-rail id-reading-rail-mobile" aria-label="Índice de esta idea">
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span><b>{String(activeIndex + 1).padStart(2, "0")}</b> de {String(items.length).padStart(2, "0")}</span>
          <strong>{activeLabel}</strong>
          <svg viewBox="0 0 20 20" aria-hidden>
            <path d="M7 3.5 13.5 10 7 16.5" />
          </svg>
        </button>
        {open ? (
          <nav aria-label="Secciones de la idea">
            <ol>
              {items.map((item, index) => (
                <li key={item.id} className={activeId === item.id ? "is-active" : undefined}>
                  <a href={`#${item.id}`} onClick={() => { setActiveId(item.id); setOpen(false); }}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <i className="id-mobile-progress" style={{ width: `${progress}%` }} aria-hidden />
      </aside>
    );
  }

  return (
    <aside className="id-reading-rail id-reading-rail-desktop" aria-label="Índice de esta idea">
      <ol>
        {items.map((item, index) => (
          <li key={item.id} className={activeId === item.id ? "is-active" : undefined}>
            <a href={`#${item.id}`} onClick={() => setActiveId(item.id)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.label}
            </a>
          </li>
        ))}
      </ol>
      <div className="id-reading-progress" aria-label={`${progress}% de avance de lectura`}>
        <span><i style={{ height: `${progress}%` }} /></span>
        <small>{progress}%</small>
      </div>
    </aside>
  );
}
