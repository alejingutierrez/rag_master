import Link from "next/link";
import type { HomeStory } from "./types";
import { EditorialArrow, EditorialImage, SectionMark } from "./primitives";

export function HomeEssays({
  essays,
  editionLabel,
}: {
  essays: HomeStory[];
  editionLabel: string;
}) {
  const central = essays[0];

  return (
    <section className="hc-section hc-essays" aria-labelledby="hc-essays-title">
      <SectionMark
        number="04"
        eyebrow="Lecturas de fondo"
        title="Ensayo central"
        description={`Una interpretación extensa y sus lecturas relacionadas para comprender ${editionLabel}.`}
      />

      {central ? (
        <div className="hc-essay-layout">
          <article className="hc-central-essay">
            <div className="hc-story-meta">
              <span>{central.label}</span>
              {central.yearLabel ? <span>{central.yearLabel}</span> : null}
              <span>Lectura de fondo</span>
            </div>
            <h3><Link href={central.href}>{central.title}</Link></h3>
            {central.summary ? <p>{central.summary}</p> : null}
            <div className="hc-essay-byline">
              <span>Alejandro Gutiérrez</span>
              <Link href={central.href}>Leer el ensayo <EditorialArrow /></Link>
            </div>
            <Link href={central.href} className="hc-essay-image-link" tabIndex={-1} aria-hidden>
              <EditorialImage src={central.imageUrl} alt="" className="hc-essay-image" width={1400} />
            </Link>
          </article>

          <aside className="hc-related-readings">
            <div className="hc-column-label">Lecturas relacionadas</div>
            {essays.slice(1, 5).map((essay, index) => (
              <article key={essay.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{essay.label}{essay.yearLabel ? ` · ${essay.yearLabel}` : ""}</small>
                  <h4><Link href={essay.href}>{essay.title}</Link></h4>
                  {essay.summary ? <p>{essay.summary}</p> : null}
                </div>
              </article>
            ))}
            <Link href="/ensayos" className="hc-text-link">Ver todos los ensayos <EditorialArrow /></Link>
          </aside>
        </div>
      ) : (
        <div className="hc-empty-editorial">
          <p className="hc-eyebrow">Próxima publicación</p>
          <h3>Esta edición todavía no tiene un ensayo de fondo publicado.</h3>
          <p>Mientras se construye esa lectura, puede recorrer sus hechos, protagonistas y fuentes.</p>
          <Link href="/ensayos">Abrir todos los ensayos <EditorialArrow /></Link>
        </div>
      )}
    </section>
  );
}
