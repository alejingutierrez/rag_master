"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import type { HomeStory } from "./types";
import { EditorialArrow, EditorialImage, SectionMark } from "./primitives";

export function HomeChronology({
  stories,
  editionLabel,
  allHref,
  initialStoryId,
}: {
  stories: HomeStory[];
  editionLabel: string;
  allHref: string;
  initialStoryId?: string;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const initialIndex = initialStoryId
      ? stories.findIndex((story) => story.id === initialStoryId)
      : -1;
    return initialIndex >= 0 ? initialIndex : 0;
  });
  const selected = stories[Math.min(selectedIndex, stories.length - 1)];

  function selectAndFocus(index: number) {
    const nextIndex = Math.max(0, Math.min(index, stories.length - 1));
    setSelectedIndex(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") selectAndFocus(0);
    else if (event.key === "End") selectAndFocus(stories.length - 1);
    else if (event.key === "ArrowLeft") selectAndFocus((index - 1 + stories.length) % stories.length);
    else selectAndFocus((index + 1) % stories.length);
  }

  return (
    <section className="hc-section hc-chronology" aria-labelledby="hc-chronology-title">
      <SectionMark
        number="02"
        eyebrow="Cronología interactiva"
        title="Los hechos, puestos en relación"
        description={`Seleccione un hito para abrir su historia dentro de la edición ${editionLabel}.`}
      />

      {selected ? (
        <>
          <div className="hc-timeline" role="tablist" aria-label={`Hechos de ${editionLabel}`}>
            {stories.map((story, index) => (
              <button
                key={story.id}
                id={`hc-timeline-tab-${index}`}
                ref={(node) => { tabRefs.current[index] = node; }}
                type="button"
                role="tab"
                tabIndex={index === selectedIndex ? 0 : -1}
                aria-selected={index === selectedIndex}
                aria-controls="hc-timeline-panel"
                className={index === selectedIndex ? "is-active" : ""}
                onClick={() => setSelectedIndex(index)}
                onKeyDown={(event) => handleTabKey(event, index)}
              >
                <span>{story.yearLabel ?? String(index + 1).padStart(2, "0")}</span>
                <i />
                <strong>{story.title}</strong>
              </button>
            ))}
          </div>

          <article
            id="hc-timeline-panel"
            role="tabpanel"
            aria-labelledby={`hc-timeline-tab-${selectedIndex}`}
            className="hc-timeline-panel"
          >
            <Link href={selected.href} className="hc-timeline-media" tabIndex={-1} aria-hidden>
              <EditorialImage src={selected.imageUrl} alt="" className="hc-timeline-image" width={960} />
            </Link>
            <div className="hc-timeline-copy">
              <div className="hc-story-meta">
                <span>{selected.label}</span>
                {selected.yearLabel ? <span>{selected.yearLabel}</span> : null}
              </div>
              <h3><Link href={selected.href}>{selected.title}</Link></h3>
              {selected.summary ? <p>{selected.summary}</p> : null}
              {selected.people?.length ? (
                <div className="hc-timeline-people">
                  <span>Protagonistas</span>
                  {selected.people.slice(0, 4).map((person) => (
                    <Link key={person.href} href={person.href}>{person.name}</Link>
                  ))}
                </div>
              ) : null}
              <div className="hc-panel-actions">
                <Link href={selected.href}>Abrir el hecho <EditorialArrow /></Link>
                <Link href={allHref}>Ver la cronología completa <EditorialArrow /></Link>
              </div>
            </div>
          </article>
        </>
      ) : (
        <div className="hc-empty-editorial">
          <p className="hc-eyebrow">Cronología en construcción</p>
          <h3>Esta edición todavía no tiene hechos fechados para recorrer.</h3>
          <p>Puede continuar por sus ensayos, protagonistas, lugares y fuentes.</p>
          <Link href={allHref}>Abrir la línea de tiempo completa <EditorialArrow /></Link>
        </div>
      )}
    </section>
  );
}
