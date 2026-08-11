import Link from "next/link";
import { EditorialArrow, EditorialImage } from "@/components/public/home/primitives";
import { groupEssaySources } from "@/components/public/hechos/source-bibliography";
import { PublicShell } from "@/components/public/public-shell";
import {
  extractProseHeadings,
  renderProse,
  type ProseHeading,
} from "@/components/public/prose";
import { periodInfo } from "@/lib/design-tokens";
import type { EntityLinker } from "@/lib/entity-linker";
import type { TypologyDetail } from "@/lib/public-data";
import { QuestionReadingRail } from "./question-reading-rail";
import "@/components/public/article.css";
import "./question-detail.css";

function articleWithoutRepeatedTitle(markdown: string, title: string): string {
  const lines = markdown.split("\n");
  const firstContent = lines.findIndex((line) => line.trim().length > 0);
  if (firstContent < 0) return "";
  const heading = lines[firstContent].match(/^#\s+(.+)$/);
  if (!heading) return markdown.trim();

  const clean = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
  if (clean(heading[1]) === clean(title)) lines.splice(firstContent, 1);
  return lines.join("\n").trim();
}

function pagesLabel(pages: number[]): string | null {
  if (!pages.length) return null;
  if (pages.length <= 5) return `p. ${pages.join(", ")}`;
  return `p. ${pages.slice(0, 4).join(", ")} y ${pages.length - 4} más`;
}

function DocumentArchive({ detail }: { detail: TypologyDetail }) {
  const documents = groupEssaySources(detail.sources);
  return (
    <section className="qd-documents" id="qd-documentos" aria-labelledby="qd-documents-title">
      <header className="qd-section-heading">
        <span>03</span>
        <div>
          <p>Archivo documental</p>
          <h2 id="qd-documents-title">Documentos usados en esta lectura</h2>
          <small>
            {documents.length.toLocaleString("es-CO")} documentos ·{" "}
            {detail.sources.length.toLocaleString("es-CO")} fragmentos de referencia
          </small>
        </div>
      </header>

      {documents.length ? (
        <div className="qd-document-list">
          {documents.map((document, index) => (
            <details key={document.key} className="qd-document">
              {document.sources.map((source) => (
                <span key={source.n} id={`f${source.n}`} className="qd-source-anchor" aria-hidden />
              ))}
              <summary>
                <span className="qd-document-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="qd-document-copy">
                  <strong>{document.title}</strong>
                  <small>
                    {[document.author, document.publicationYear, pagesLabel(document.pages)]
                      .filter(Boolean)
                      .join(" · ") || "Documento del corpus"}
                  </small>
                </span>
                <span className="qd-document-count">
                  {document.sources.length}{" "}
                  {document.sources.length === 1 ? "fragmento" : "fragmentos"}
                </span>
              </summary>
              <div className="qd-document-fragments">
                {document.sources.map((source) => (
                  <blockquote key={source.n}>
                    <b>[{source.n}]</b>
                    <p>{source.snippet ?? "Fragmento conservado en el corpus editorial."}</p>
                    {source.page != null ? <small>p. {source.page}</small> : null}
                  </blockquote>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="qd-documents-empty">
          Esta lectura conserva sus fuentes en el corpus editorial.
        </p>
      )}
    </section>
  );
}

export function QuestionDetailArticle({
  detail,
  linker,
}: {
  detail: TypologyDetail;
  linker?: EntityLinker | null;
}) {
  if (detail.structured.typology !== "pregunta") return null;

  const question = detail.structured;
  const period = question.periodoCode ? periodInfo(question.periodoCode) : null;
  const body = articleWithoutRepeatedTitle(detail.answer, question.titulo);
  const articleHeadings = extractProseHeadings(body, "qd-reading-");
  const documents = groupEssaySources(detail.sources);
  const readingMinutes = Math.max(1, Math.ceil(detail.wordCount / 220));
  const railHeadings: ProseHeading[] = [
    { id: "qd-en-breve", level: 2, text: "En breve" },
    { id: "qd-lectura", level: 2, text: "La lectura" },
    ...articleHeadings.map((heading) => ({ ...heading, level: 3 as const })),
    { id: "qd-documentos", level: 2, text: "Documentos" },
  ];

  return (
    <PublicShell>
      <article className="qd-page" data-question-article>
        <div className="qd-shell">
          <nav className="qd-breadcrumb" aria-label="Miga de pan">
            <Link href="/ensayos">Lecturas</Link>
            <span>/</span>
            <span>{period?.label ?? "Larga duración"}</span>
            <span>/</span>
            <span aria-current="page">{question.titulo}</span>
          </nav>

          <section className="qd-hero" aria-labelledby="qd-title">
            <header className="qd-hero-copy">
              <p className="qd-kind">
                Ensayo{period ? ` · ${period.label}` : ""}
                {detail.yearRange ? ` · ${detail.yearRange}` : ""}
              </p>
              <h1 id="qd-title">{question.titulo}</h1>
              <p className="qd-summary">{question.resumen}</p>
              <div className="qd-metrics" aria-label="Dimensión de esta lectura">
                <span>{readingMinutes} min de lectura</span>
                <span>{detail.wordCount.toLocaleString("es-CO")} palabras</span>
                <span>{documents.length.toLocaleString("es-CO")} documentos</span>
                <span>{detail.sources.length.toLocaleString("es-CO")} fragmentos</span>
              </div>
            </header>

            <figure className="qd-cover">
              <EditorialImage
                src={detail.imageUrl}
                alt={detail.imageUrl ? question.titulo : ""}
                eager
                width={1400}
                sizes="(max-width: 760px) 100vw, 42vw"
              />
              <figcaption>
                Por Alejandro Gutiérrez · actualizado {detail.dateLabel}
              </figcaption>
            </figure>
          </section>

          <section className="qd-brief" id="qd-en-breve" aria-labelledby="qd-brief-title">
            <header className="qd-section-heading">
              <span>01</span>
              <div>
                <p>Orientación para entrar</p>
                <h2 id="qd-brief-title">La respuesta en breve</h2>
              </div>
            </header>
            <div className="qd-brief-grid">
              <article>
                <small>La tesis</small>
                <p>{question.tesis || question.resumen}</p>
              </article>
              <article>
                <small>La tensión</small>
                <p>{question.debate || "Esta lectura contrasta las interpretaciones disponibles."}</p>
              </article>
            </div>
            {question.temasRelacionados.length ? (
              <div className="qd-themes" aria-label="Temas relacionados">
                <span>Temas</span>
                <div>
                  {question.temasRelacionados.map((theme) => (
                    <small key={theme}>{theme}</small>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <div className="qd-reading-layout">
            <QuestionReadingRail headings={railHeadings} readingMinutes={readingMinutes} />

            <main className="qd-reading-column">
              <section className="qd-reading" id="qd-lectura" aria-labelledby="qd-reading-title">
                <header className="qd-section-heading">
                  <span>02</span>
                  <div>
                    <p>Ensayo completo</p>
                    <h2 id="qd-reading-title">La lectura</h2>
                  </div>
                </header>
                <div className="prose qd-prose">
                  {renderProse(body, { linker, headingPrefix: "qd-reading-" })}
                </div>
              </section>

              <DocumentArchive detail={detail} />
            </main>
          </div>

          <nav className="qd-return" aria-label="Continuar explorando">
            <Link href="/ensayos">
              <span>
                <small>Seguir explorando</small>
                <strong>Volver a todas las lecturas</strong>
              </span>
              <EditorialArrow />
            </Link>
          </nav>
        </div>
      </article>
    </PublicShell>
  );
}
