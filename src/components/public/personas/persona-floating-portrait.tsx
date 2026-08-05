"use client";

import { useEffect, useRef, useState } from "react";
import { imageAt } from "@/lib/image-url";

export function PersonaFloatingPortrait({
  imageUrl,
  title,
}: {
  imageUrl: string | null;
  title: string;
}) {
  const [docked, setDocked] = useState(false);
  const frame = useRef<number | null>(null);
  const portraitUrl = imageAt(imageUrl, 1400);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 981px)");

    const update = () => {
      frame.current = null;
      const hero = document.querySelector<HTMLElement>(".pd-hero");
      setDocked(Boolean(hero && desktop.matches && hero.getBoundingClientRect().top <= 60));
    };

    const requestUpdate = () => {
      if (frame.current == null) frame.current = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    desktop.addEventListener("change", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      desktop.removeEventListener("change", requestUpdate);
      if (frame.current != null) window.cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <aside className="pd-portrait-track" aria-label={`Retrato de ${title}`}>
      {portraitUrl ? (
        <figure className="pd-floating-portrait" data-docked={docked || undefined}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portraitUrl} alt={`Retrato de ${title}`} fetchPriority="high" />
        </figure>
      ) : (
        <div className="pd-floating-portrait pd-floating-portrait-fallback" data-docked={docked || undefined} aria-hidden>
          <span>{title.charAt(0)}</span>
        </div>
      )}
    </aside>
  );
}
