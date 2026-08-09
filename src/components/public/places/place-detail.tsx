import Link from "next/link";
import { BookOpenText, FileText, MapPin } from "lucide-react";
import { EntityConnections } from "@/components/public/entity-node";
import { groupEssaySources } from "@/components/public/hechos/source-bibliography";
import { extractProseHeadings, renderProse } from "@/components/public/prose";
import { PublicShell } from "@/components/public/public-shell";
import { periodInfo } from "@/lib/design-tokens";
import type { EntityLinker } from "@/lib/entity-linker";
import { imageAt } from "@/lib/image-url";
import { ENTITY_TYPE_META, type EntityNode, type EntityPieceRef, type TypologyDetail } from "@/lib/public-data";
import type { EntidadStructured } from "@/lib/typology-schemas";
import "@/components/public/article.css";
import "@/components/public/wiki.css";
import "./place-detail.css";

const CHAPTER_LIMIT = 5;
const NODE_READING_LIMIT = 12;

function removeRepeatedTitle(markdown: string, title: string): string {
  const lines = markdown.split("\n");
  const firstContent = lines.findIndex((line) => line.trim().length > 0);
  if (firstContent < 0) return "";
  const match = lines[firstContent].match(/^#\s+(.+)$/);
  if (match && match[1].trim().localeCompare(title, "es", { sensitivity: "base" }) === 0) {
    lines.splice(firstContent, 1);
  }
  return lines.join("\n").trim();
}

function splitOpening(markdown: string): { opening: string; body: string } {
  const lines = markdown.split("\n");
  const firstSection = lines.findIndex((line) => /^#{1,3}\s+/.test(line));
  if (firstSection <= 0) return { opening: "", body: markdown.trim() };
  return {
    opening: lines.slice(0, firstSection).join("\n").trim(),
    body: lines.slice(firstSection).join("\n").trim(),
  };
}

function editorialExcerpt(text: string, maxLength = 280): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sentence = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? normalized;
  if (sentence.length <= maxLength) return sentence;
  const clipped = sentence.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
  return `${clipped}…`;
}

function coordinateLabel(value: number | null, axis: "lat" | "lng"): string | null {
  if (value == null) return null;
  const direction = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "O";
  return `${Math.abs(value).toFixed(3)}° ${direction}`;
}

function yearLabel(year: number | null): string {
  if (year == null) return "Sin fecha";
  return year < 0 ? `${Math.abs(year)} a. C.` : String(year);
}

const PIECE_KIND_LABEL: Record<string, string> = {
  hecho: "Hecho",
  epoca: "Época",
  entidad: "Ficha",
  pregunta: "Ensayo",
  ensayo: "Ensayo",
};

function PlaceReadingRow({ piece }: { piece: EntityPieceRef }) {
  return (
    <Link href={piece.href} className="ld-reading-row">
      <span>{yearLabel(piece.anio)}</span>
      <div>
        <small>{PIECE_KIND_LABEL[piece.kind] ?? piece.kind}</small>
        <strong>{piece.titulo}</strong>
      </div>
      <i aria-hidden>→</i>
    </Link>
  );
}

function pageLabel(pages: number[]): string | null {
  if (!pages.length) return null;
  if (pages.length <= 4) return `p. ${pages.join(", ")}`;
  return `p. ${pages.slice(0, 3).join(", ")} y ${pages.length - 3} más`;
}

function PlaceSources({ detail }: { detail: TypologyDetail }) {
  const documents = groupEssaySources(detail.sources);
  return (
    <section className="ld-sources" id="ld-fuentes" aria-labelledby="ld-sources-title">
      <header className="ld-section-head">
        <span>Fuentes</span>
        <div>
          <p>Archivo documental</p>
          <h2 id="ld-sources-title">Documentos y fragmentos citados</h2>
          <small>
            {documents.length.toLocaleString("es-CO")} documentos · {detail.sources.length.toLocaleString("es-CO")} fragmentos
          </small>
        </div>
      </header>

      {documents.length ? (
        <div className="ld-source-list">
          {documents.map((document, index) => (
            <details key={document.key}>
              {document.sources.map((source) => (
                <span key={source.n} id={`f${source.n}`} className="ld-source-anchor" aria-hidden />
              ))}
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{document.title}</strong>
                  <small>
                    {[document.author, document.publicationYear, pageLabel(document.pages)]
                      .filter(Boolean)
                      .join(" · ") || "Documento del corpus"}
                  </small>
                </div>
                <i>{document.sources.length} {document.sources.length === 1 ? "cita" : "citas"}</i>
              </summary>
              <div className="ld-source-fragments">
                {document.sources.map((source) => (
                  <blockquote key={source.n}>
                    <b>[{source.n}]</b>
                    <p>{source.snippet ?? "Fragmento referenciado en el corpus editorial."}</p>
                    {source.page != null ? <small>p. {source.page}</small> : null}
                  </blockquote>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="ld-source-empty">Esta historia conserva sus fuentes en el corpus editorial.</p>
      )}
    </section>
  );
}

function PlaceIdentity({ place, node }: { place: EntidadStructured; node: EntityNode }) {
  const lat = coordinateLabel(place.lat, "lat");
  const lng = coordinateLabel(place.lng, "lng");
  const periods = node.periods
    .map((code) => periodInfo(code)?.label)
    .filter((label): label is string => Boolean(label));

  return (
    <aside className="ld-identity" aria-label="Identidad del lugar">
      <div className="ld-identity-inner">
        <p className="ld-identity-copy">{editorialExcerpt(place.resumen || place.semblanza)}</p>
        <div className="ld-place-fact">
          <MapPin aria-hidden />
          <div>
            <span>Ubicación documentada</span>
            <strong>{place.lugarPrincipal || place.titulo}</strong>
            {lat && lng ? <small>{lat} · {lng}</small> : null}
          </div>
        </div>
        {place.roles.length ? (
          <div className="ld-place-roles">
            <span>Naturaleza histórica</span>
            {place.roles.slice(0, 3).map((role) => <p key={role}>{role}</p>)}
          </div>
        ) : null}
        {periods.length ? (
          <div className="ld-place-periods">
            <span>Presente en</span>
            <p>
              {periods.slice(0, 3).join(" · ")}
              {periods.length > 3 ? ` · +${periods.length - 3}` : ""}
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function PlaceContinuity({
  place,
  node,
  sourceCount,
}: {
  place: EntidadStructured;
  node: EntityNode;
  sourceCount: number;
}) {
  const nextPiece = node.pieces.find((piece) => piece.href !== node.href);
  return (
    <aside className="ld-continuity" aria-label="Continuar explorando">
      <div className="ld-continuity-inner">
        <section className="ld-archive-stats">
          <span>En el archivo</span>
          <dl>
            <div><dt>{node.pieces.length.toLocaleString("es-CO")}</dt><dd>apariciones</dd></div>
            <div><dt>{place.hitos.length.toLocaleString("es-CO")}</dt><dd>hitos</dd></div>
            <div><dt>{sourceCount.toLocaleString("es-CO")}</dt><dd>fuentes</dd></div>
          </dl>
        </section>

        {place.hitos.length ? (
          <section className="ld-milestones">
            <span>Hitos del lugar</span>
            <ol>
              {place.hitos.slice(0, 4).map((milestone, index) => (
                <li key={`${milestone.year ?? "sin-fecha"}-${index}`}>
                  <b>{yearLabel(milestone.year)}</b>
                  <p>{milestone.titulo}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {nextPiece ? (
          <Link href={nextPiece.href} className="ld-next-piece">
            <span>Seguir después</span>
            <strong>{nextPiece.titulo}</strong>
            <small>{yearLabel(nextPiece.anio)} · Continuar →</small>
          </Link>
        ) : (
          <Link href="/lugares" className="ld-next-piece">
            <span>Seguir explorando</span>
            <strong>Todos los lugares</strong>
            <small>Volver al atlas →</small>
          </Link>
        )}
      </div>
    </aside>
  );
}

export function PlaceDetailArticle({
  detail,
  node,
  linker,
  selfKey,
}: {
  detail: TypologyDetail;
  node: EntityNode;
  linker?: EntityLinker | null;
  selfKey?: string;
}) {
  if (detail.structured.typology !== "entidad" || detail.structured.tipo !== "Lugar") return null;
  const place = detail.structured;
  const article = removeRepeatedTitle(detail.answer, place.titulo);
  const { opening, body } = splitOpening(article);
  const headings = extractProseHeadings(body, "ld-").slice(0, CHAPTER_LIMIT);
  const readingMinutes = Math.max(1, Math.ceil(detail.wordCount / 220));
  const heroImage = imageAt(detail.imageUrl, 1400);

  return (
    <PublicShell>
      <article className="ld-page" data-place-article>
        <header className={`ld-hero${heroImage ? " has-image" : ""}`}>
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt="" aria-hidden className="ld-hero-image" fetchPriority="high" />
          ) : null}
          <div className="ld-hero-copy">
            <Link href="/lugares">Una historia del territorio</Link>
            <h1>{place.titulo}</h1>
            <p>“{editorialExcerpt(place.semblanza || place.resumen, 250)}”</p>
            <div className="ld-hero-meta">
              <span><BookOpenText aria-hidden />{readingMinutes} min de lectura</span>
              <span><FileText aria-hidden />{detail.sources.length.toLocaleString("es-CO")} fuentes</span>
            </div>
          </div>
        </header>

        <nav className="ld-chapters" aria-label="Capítulos de esta historia">
          <div>
            {headings.length ? headings.map((heading, index) => (
              <a href={`#${heading.id}`} key={heading.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>{heading.text}
              </a>
            )) : <a href="#ld-lectura"><span>01</span>La historia</a>}
            <a href="#ld-fuentes"><span>{String(headings.length + 1).padStart(2, "0")}</span>Fuentes</a>
          </div>
        </nav>

        <div className="ld-shell">
          <div className="ld-reading-layout">
            <PlaceIdentity place={place} node={node} />

            <main className="ld-reading" id="ld-lectura">
              {opening ? (
                <div className="ld-opening">
                  {renderProse(opening, { linker, selfKey, headingPrefix: "ld-opening-" })}
                </div>
              ) : null}
              <div className="ld-prose">
                {renderProse(body || article, { linker, selfKey, headingPrefix: "ld-" })}
              </div>
            </main>

            <PlaceContinuity place={place} node={node} sourceCount={detail.sources.length} />
          </div>

          <section className="ld-connections" aria-labelledby="ld-connections-title">
            <header className="ld-section-head">
              <span>Conexiones</span>
              <div>
                <p>El territorio en el archivo</p>
                <h2 id="ld-connections-title">Dónde aparece y con qué se relaciona</h2>
              </div>
            </header>
            <EntityConnections pieces={node.pieces} related={node.related} selfHref={node.href} />
          </section>

          <PlaceSources detail={detail} />
        </div>
      </article>
    </PublicShell>
  );
}

/**
 * Lugar con una lectura dedicada publicada, pero sin ficha monográfica. Mantiene
 * el mismo sistema de la interna larga y hace que el contenido central sea el
 * archivo real disponible: piezas, periodos y relaciones; no inventa narrativa.
 */
export function PlaceNodeArticle({ node }: { node: EntityNode }) {
  const heroImage = imageAt(node.imageUrl, 1400);
  const readings = node.pieces.filter((piece) => piece.href !== node.href);
  const visibleReadings = readings.slice(0, NODE_READING_LIMIT);
  const remainingReadings = readings.slice(NODE_READING_LIMIT);
  const periods = node.periods
    .map((code) => periodInfo(code)?.label)
    .filter((label): label is string => Boolean(label));
  const description =
    node.resumen ??
    `Lecturas publicadas donde ${node.name} permite recorrer la historia de Colombia desde el territorio.`;

  return (
    <PublicShell>
      <article className="ld-page ld-node-page" data-place-node>
        <header className={`ld-hero${heroImage ? " has-image" : ""}`}>
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt="" aria-hidden className="ld-hero-image" fetchPriority="high" />
          ) : null}
          <div className="ld-hero-copy">
            <Link href="/lugares">Un lugar en el archivo</Link>
            <h1>{node.name}</h1>
            <p>“{editorialExcerpt(description, 250)}”</p>
            <div className="ld-hero-meta">
              <span><BookOpenText aria-hidden />{readings.length.toLocaleString("es-CO")} {readings.length === 1 ? "lectura" : "lecturas"}</span>
              <span><FileText aria-hidden />{node.related.length.toLocaleString("es-CO")} conexiones</span>
            </div>
          </div>
        </header>

        <nav className="ld-chapters" aria-label="Secciones de este lugar">
          <div>
            <a href="#ld-lecturas"><span>01</span>Lecturas</a>
            <a href="#ld-relaciones"><span>02</span>Conexiones</a>
            <Link href="/lugares"><span>03</span>Todos los lugares</Link>
          </div>
        </nav>

        <div className="ld-shell">
          <div className="ld-reading-layout">
            <aside className="ld-identity" aria-label="Identidad del lugar">
              <div className="ld-identity-inner">
                <p className="ld-identity-copy">{editorialExcerpt(description)}</p>
                <div className="ld-place-fact">
                  <MapPin aria-hidden />
                  <div>
                    <span>Identidad territorial</span>
                    <strong>{node.name}</strong>
                    <small>Nombre canónico del archivo</small>
                  </div>
                </div>
                {periods.length ? (
                  <div className="ld-place-periods">
                    <span>Presente en</span>
                    <p>
                      {periods.slice(0, 4).join(" · ")}
                      {periods.length > 4 ? ` · +${periods.length - 4}` : ""}
                    </p>
                  </div>
                ) : null}
              </div>
            </aside>

            <main className="ld-reading ld-node-reading" id="ld-lecturas">
              <p className="ld-node-kicker">Historias conectadas</p>
              <h2>Leer {node.name} a través del archivo</h2>
              <p className="ld-node-intro">
                Esta selección reúne las piezas publicadas que construyen su contexto histórico.
                Cada entrada conserva el título, la fecha y el tipo editorial de la fuente real.
              </p>
              {readings.length ? (
                <div className="ld-reading-list">
                  {visibleReadings.map((piece) => (
                    <PlaceReadingRow key={`${piece.href}-${piece.titulo}`} piece={piece} />
                  ))}
                  {remainingReadings.length ? (
                    <details className="ld-reading-more">
                      <summary>
                        Ver {remainingReadings.length === 1 ? "la lectura restante" : `las ${remainingReadings.length} lecturas restantes`}
                      </summary>
                      <div>
                        {remainingReadings.map((piece) => (
                          <PlaceReadingRow key={`${piece.href}-${piece.titulo}`} piece={piece} />
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : (
                <p className="ld-reading-empty">La lectura dedicada de este lugar está disponible desde el atlas.</p>
              )}
            </main>

            <aside className="ld-continuity" aria-label="Continuar explorando">
              <div className="ld-continuity-inner">
                <section className="ld-archive-stats">
                  <span>En el archivo</span>
                  <dl>
                    <div><dt>{readings.length.toLocaleString("es-CO")}</dt><dd>lecturas</dd></div>
                    <div><dt>{periods.length.toLocaleString("es-CO")}</dt><dd>épocas</dd></div>
                    <div><dt>{node.related.length.toLocaleString("es-CO")}</dt><dd>conexiones</dd></div>
                  </dl>
                </section>

                {node.related.length ? (
                  <section className="ld-node-related">
                    <span>Cerca de este lugar</span>
                    <div>
                      {node.related.slice(0, 4).map((relation) => (
                        <Link href={relation.href} key={`${relation.type}-${relation.slug}`}>
                          <i style={{ background: ENTITY_TYPE_META[relation.type].color }} aria-hidden />
                          <b>{relation.name}</b>
                          <small>{relation.shared} {relation.shared === 1 ? "cruce" : "cruces"}</small>
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}

                <Link href="/lugares" className="ld-next-piece">
                  <span>Seguir explorando</span>
                  <strong>Todos los lugares</strong>
                  <small>Volver al atlas →</small>
                </Link>
              </div>
            </aside>
          </div>

          <section className="ld-connections" id="ld-relaciones" aria-labelledby="ld-connections-title">
            <header className="ld-section-head">
              <span>Conexiones</span>
              <div>
                <p>El territorio en el archivo</p>
                <h2 id="ld-connections-title">Dónde aparece y con qué se relaciona</h2>
              </div>
            </header>
            <EntityConnections pieces={node.pieces} related={node.related} selfHref={node.href} />
          </section>
        </div>
      </article>
    </PublicShell>
  );
}
