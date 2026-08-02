"use client";

import { useEffect, useRef, useState } from "react";
import type { ProseHeading } from "@/components/public/prose";

export function HechoReadingRail({ headings }: { headings: ProseHeading[] }) {
  const progressRef = useRef<HTMLSpanElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [active, setActive] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    const updateProgress = () => {
      frameRef.current = null;
      const article = document.querySelector<HTMLElement>("[data-hecho-article]");
      if (!article || !progressRef.current) return;
      const rect = article.getBoundingClientRect();
      const distance = Math.max(article.offsetHeight - window.innerHeight, 1);
      const progress = Math.min(1, Math.max(0, -rect.top / distance));
      progressRef.current.style.transform = `scaleY(${progress})`;
    };
    const onScroll = () => {
      if (frameRef.current == null) frameRef.current = window.requestAnimationFrame(updateProgress);
    };
    updateProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => !!element);
    if (!elements.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-18% 0px -68% 0px", threshold: [0, 1] },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [headings]);

  return (
    <aside className="hd-reading-rail" aria-label="Índice del hecho">
      <span className="hd-rail-label">En esta página</span>
      <div className="hd-rail-body">
        <span className="hd-rail-track" aria-hidden><span ref={progressRef} /></span>
        <ol>
          {headings.map((heading, index) => (
            <li key={heading.id} className={`${heading.level === 3 ? "is-sub" : ""}${active === heading.id ? " is-active" : ""}`}>
              <a href={`#${heading.id}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
