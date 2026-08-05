"use client";

import { useEffect, useRef, useState } from "react";

export interface PersonaRailItem {
  id: string;
  label: string;
}

export function PersonaReadingRail({
  items,
  readingMinutes,
}: {
  items: PersonaRailItem[];
  readingMinutes: number;
}) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      frame.current = null;
      const article = document.querySelector<HTMLElement>("[data-persona-article]");
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const distance = Math.max(article.offsetHeight - window.innerHeight, 1);
      const next = Math.min(100, Math.max(0, ((window.scrollY - start) / distance) * 100));
      setProgress(Math.round(next));
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
      .filter((element): element is HTMLElement => !!element);
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-16% 0px -70% 0px", threshold: [0, 1] },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [items]);

  return (
    <aside className="pd-reading-rail" aria-label="Índice de esta biografía">
      <span className="pd-rail-title">En esta vida</span>
      <ol>
        {items.map((item, index) => (
          <li key={item.id} className={active === item.id ? "is-active" : undefined}>
            <a href={`#${item.id}`}>
              <i aria-hidden />
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item.label}
            </a>
          </li>
        ))}
      </ol>
      <div className="pd-progress" aria-label={`${progress}% de avance de lectura`}>
        <div>
          <strong>{progress}%</strong>
          <span>Avance de lectura</span>
        </div>
        <span className="pd-progress-time">{readingMinutes} min</span>
        <div className="pd-progress-track" aria-hidden>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
    </aside>
  );
}
