import Link from "next/link";
import type { HomeStory } from "./types";
import { EditorialArrow, SectionMark } from "./primitives";

function publishedLabel(value: string | null): string {
  if (!value) return "Archivo";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Archivo";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function HomeRecentIndex({
  stories,
  editionLabel,
}: {
  stories: HomeStory[];
  editionLabel: string;
}) {
  return (
    <section className="hc-section hc-recent" aria-labelledby="hc-recent-title">
      <SectionMark
        number="05"
        eyebrow="Índice vivo"
        title={`Todo lo publicado sobre ${editionLabel}`}
        description="Un índice de trabajo: tipo, título, fecha histórica y fecha de publicación."
      />

      <div className="hc-index-table" role="table" aria-label={`Piezas de ${editionLabel}`}>
        <div className="hc-index-row hc-index-row-head" role="row">
          <span role="columnheader">Tipo</span>
          <span role="columnheader">Título</span>
          <span role="columnheader" className="hc-index-dates">
            <span>Año histórico</span>
            <span>Publicado</span>
          </span>
          <span role="columnheader" className="hc-visually-hidden">Acción</span>
        </div>
        {stories.slice(0, 8).map((story) => (
          <Link href={story.href} key={story.id} className="hc-index-row" role="row">
            <span role="cell" className="hc-index-kind">{story.label}</span>
            <strong role="cell">{story.title}</strong>
            <span role="cell" className="hc-index-dates">
              <span>{story.yearLabel ?? "—"}</span>
              <span>{publishedLabel(story.publishedAt)}</span>
            </span>
            <span role="cell"><EditorialArrow /></span>
          </Link>
        ))}
        {!stories.length ? (
          <div className="hc-index-empty-row" role="row">
            <span role="cell">Todavía no hay piezas publicadas para esta edición.</span>
          </div>
        ) : null}
      </div>
      <div className="hc-index-actions">
        <span>{stories.length} {stories.length === 1 ? "pieza en esta edición" : "piezas en esta edición"}</span>
        <Link href="/archivo">Abrir el archivo completo <EditorialArrow /></Link>
      </div>
    </section>
  );
}
