import Link from "next/link";
import { EditorialArrow, EditorialImage } from "@/components/public/home/primitives";
import { groupEssaySources } from "@/components/public/hechos/source-bibliography";
import { PublicShell } from "@/components/public/public-shell";
import { renderProse } from "@/components/public/prose";
import { PERIOD_ORDER, periodInfo } from "@/lib/design-tokens";
import type { EntityLinker } from "@/lib/entity-linker";
import type {
  EntityNode,
  EntityPieceRef,
  EntityRelation,
  EssaySource,
  TypologyDetail,
} from "@/lib/public-data";
import type { EntidadStructured } from "@/lib/typology-schemas";
import { IdeaReadingRail, type IdeaRailItem } from "./idea-reading-rail";
import "@/components/public/article.css";
import "./idea-detail.css";

const RAIL_ITEMS: IdeaRailItem[] = [
  { id: "id-en-breve", label: "En breve" },
  { id: "id-trayectoria", label: "Trayectoria" },
  { id: "id-lectura", label: "La lectura" },
  { id: "id-archivo", label: "En el archivo" },
  { id: "id-relaciones", label: "Relaciones" },
  { id: "id-documentos", label: "Documentos" },
];

const RELATION_LABELS = {
  persona: "Personas",
  lugar: "Lugares",
  idea: "Ideas",
} as const;

const KIND_LABELS: Record<string, string> = {
  hecho: "Hecho",
  epoca: "Época",
  entidad: "Ficha",
  pregunta: "Pregunta",
  ensayo: "Lectura",
};

function articleWithoutRepeatedTitle(markdown: string, titles: string[]): string {
  const lines = markdown.split("\n");
  const firstContent = lines.findIndex((line) => line.trim().length > 0);
  if (firstContent < 0) return "";
  const heading = lines[firstContent].match(/^#\s+(.+)$/);
  if (!heading) return markdown.trim();
  const clean = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
  if (titles.some((title) => clean(title) === clean(heading[1]))) lines.splice(firstContent, 1);
  return lines.join("\n").trim();
}

function pagesLabel(pages: number[]): string | null {
  if (!pages.length) return null;
  if (pages.length <= 5) return `p. ${pages.join(", ")}`;
  return `p. ${pages.slice(0, 4).join(", ")} y ${pages.length - 4} más`;
}

function periodRank(code: string | null): number {
  if (!code) return PERIOD_ORDER.length + 1;
  const rank = PERIOD_ORDER.indexOf(code as (typeof PERIOD_ORDER)[number]);
  return rank < 0 ? PERIOD_ORDER.length : rank;
}

interface ArchiveGroup {
  key: string;
  label: string;
  range: string | null;
  pieces: EntityPieceRef[];
}

function groupArchive(pieces: EntityPieceRef[]): ArchiveGroup[] {
  const grouped = new Map<string, EntityPieceRef[]>();
  for (const piece of pieces) {
    const key = piece.periodCode ?? "SIN_PERIODO";
    const current = grouped.get(key) ?? [];
    current.push(piece);
    grouped.set(key, current);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => periodRank(a === "SIN_PERIODO" ? null : a) - periodRank(b === "SIN_PERIODO" ? null : b))
    .map(([key, periodPieces]) => {
      const period = key === "SIN_PERIODO" ? null : periodInfo(key);
      return {
        key,
        label: period?.label ?? "Sin período asignado",
        range: period?.yearRange ?? null,
        pieces: periodPieces.toSorted(
          (a, b) => (a.anio ?? 9999) - (b.anio ?? 9999) || a.titulo.localeCompare(b.titulo, "es"),
        ),
      };
    });
}

function Timeline({ idea }: { idea: EntidadStructured }) {
  if (!idea.hitos.length) return null;
  return (
    <section className="id-timeline" id="id-trayectoria" aria-labelledby="id-timeline-title">
      <h2 id="id-timeline-title">Trayectoria de una idea</h2>
      <ol>
        {idea.hitos.map((milestone, index) => (
          <li key={`${milestone.year ?? "sin-fecha"}:${index}`}>
            <span className="id-timeline-dot" aria-hidden />
            <strong>{milestone.year ?? "—"}</strong>
            <p>{milestone.titulo}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Archive({ node }: { node: EntityNode }) {
  const groups = groupArchive(node.pieces.filter((piece) => piece.href !== node.href));
  return (
    <section className="id-archive" id="id-archivo" aria-labelledby="id-archive-title">
      <header className="id-section-head">
        <span>04</span>
        <div>
          <h2 id="id-archive-title">En el archivo</h2>
          <p>{node.mentions.toLocaleString("es-CO")} apariciones públicas, ordenadas por período y año.</p>
        </div>
      </header>
      <div className="id-archive-groups">
        {groups.map((group, groupIndex) => (
          <details key={group.key} open={groupIndex === 0}>
            <summary>
              <span>{String(groupIndex + 1).padStart(2, "0")}</span>
              <strong>{group.label}</strong>
              <small>{group.range}</small>
              <em>{group.pieces.length}</em>
            </summary>
            <ol>
              {group.pieces.map((piece, index) => (
                <li key={`${piece.href}:${index}`}>
                  <Link href={piece.href}>
                    <span>{piece.anio ?? "—"}</span>
                    <strong>{piece.titulo}</strong>
                    <small>{KIND_LABELS[piece.kind] ?? "Pieza"}</small>
                    <EditorialArrow />
                  </Link>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}

function RelationGroup({ type, items }: { type: EntityRelation["type"]; items: EntityRelation[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3>{RELATION_LABELS[type]}</h3>
      <ol>
        {items.map((relation) => (
          <li key={`${relation.type}:${relation.slug}`}>
            <Link href={relation.href}>
              <strong>{relation.name}</strong>
              <span>{relation.shared} {relation.shared === 1 ? "pieza compartida" : "piezas compartidas"}</span>
              <EditorialArrow />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Relations({ idea, node }: { idea: EntidadStructured; node: EntityNode }) {
  return (
    <section className="id-relations" id="id-relaciones" aria-labelledby="id-relations-title">
      <header className="id-section-head">
        <span>05</span>
        <div>
          <h2 id="id-relations-title">Relaciones</h2>
          <p>Vínculos editoriales de la ficha y conexiones observadas dentro del archivo.</p>
        </div>
      </header>
      <div className="id-relations-layout">
        {idea.relaciones.length ? (
          <section className="id-editorial-relations">
            <h3>Relaciones editoriales</h3>
            <ol>
              {idea.relaciones.map((relation, index) => (
                <li key={`${relation}:${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{relation}</li>
              ))}
            </ol>
          </section>
        ) : null}
        <div className="id-corpus-relations">
          {(["persona", "lugar", "idea"] as const).map((type) => (
            <RelationGroup key={type} type={type} items={node.related.filter((relation) => relation.type === type)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DocumentList({ sources }: { sources: EssaySource[] }) {
  const groups = groupEssaySources(sources);
  return (
    <section className="id-documents" id="id-documentos" aria-labelledby="id-documents-title">
      <header className="id-section-head">
        <span>06</span>
        <div>
          <h2 id="id-documents-title">Documentos y fragmentos citados</h2>
          <p>{groups.length.toLocaleString("es-CO")} documentos · {sources.length.toLocaleString("es-CO")} fragmentos</p>
        </div>
      </header>
      <div className="id-document-list">
        {groups.map((group, index) => (
          <div className="id-document" key={group.key}>
            {group.sources.map((source) => <span id={`f${source.n}`} key={source.n} className="id-source-anchor" aria-hidden />)}
            <details>
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>
                  <strong>{group.title}</strong>
                  <small>{[group.author, group.publicationYear, pagesLabel(group.pages)].filter(Boolean).join(" · ") || "Documento del corpus"}</small>
                </span>
                <em>{group.sources.length} {group.sources.length === 1 ? "cita" : "citas"}</em>
              </summary>
              <div>
                {group.sources.map((source) => (
                  <blockquote key={source.n}>
                    <b>[{source.n}]</b>
                    <p>{source.snippet ?? "Fragmento referenciado en el corpus editorial."}</p>
                    {source.page != null ? <small>p. {source.page}</small> : null}
                  </blockquote>
                ))}
              </div>
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}

export function IdeaDetailArticle({
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
  if (detail.structured.typology !== "entidad") return null;
  if (detail.structured.tipo !== "Concepto" && detail.structured.tipo !== "Institución") return null;

  const idea = detail.structured;
  const documents = groupEssaySources(detail.sources);
  const body = articleWithoutRepeatedTitle(detail.answer, [node.name, idea.titulo]);
  const period = idea.periodoCode ? periodInfo(idea.periodoCode) : null;
  const ideaLabel = idea.periodoCode === "TRANS"
    ? "Idea transversal"
    : `${idea.tipo === "Institución" ? "Institución" : "Idea"}${period ? ` · ${period.label}` : ""}`;

  return (
    <PublicShell>
      <article className="id-page" data-idea-article>
        <div className="id-layout">
          <IdeaReadingRail items={RAIL_ITEMS} />

          <div className="id-main">
            <div className="id-hero-grid">
              <nav className="id-breadcrumb" aria-label="Miga de pan">
                <Link href="/ideas">Ideas</Link><span>/</span><span aria-current="page">{node.name}</span>
              </nav>

              <header className="id-hero-copy" id="id-en-breve">
                <p className="id-kind">{ideaLabel}</p>
                <h1>{node.name}</h1>
                <p className="id-summary">{idea.resumen}</p>
                <div className="id-metrics" aria-label="Dimensión documental de esta idea">
                  <span>{detail.wordCount.toLocaleString("es-CO")} palabras</span>
                  <span>{documents.length.toLocaleString("es-CO")} documentos</span>
                  <span>{detail.sources.length.toLocaleString("es-CO")} fragmentos citados</span>
                </div>
              </header>

              <figure className="id-cover">
                <EditorialImage
                  src={detail.imageUrl}
                  alt={detail.imageUrl ? node.name : ""}
                  eager
                  width={1400}
                  sizes="(max-width: 900px) 100vw, 68vw"
                />
              </figure>

              <IdeaReadingRail items={RAIL_ITEMS} variant="mobile" />

              <aside className="id-natures" aria-label="Naturalezas de esta idea">
                {idea.roles.map((role, index) => (
                  <section key={`${role}:${index}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <h2>{role}</h2>
                  </section>
                ))}
              </aside>
            </div>

            <Timeline idea={idea} />

            <section className="id-reading" id="id-lectura" aria-labelledby="id-reading-title">
              <header className="id-section-head">
                <span>03</span>
                <div><h2 id="id-reading-title">La lectura</h2></div>
              </header>
              {idea.semblanza ? <blockquote className="id-semblance">{idea.semblanza}</blockquote> : null}
              <div className="prose id-prose">
                {renderProse(body, { linker, selfKey, headingPrefix: "id-reading-" })}
              </div>
            </section>

            <Archive node={node} />
            <Relations idea={idea} node={node} />
            <DocumentList sources={detail.sources} />
          </div>
        </div>
      </article>
    </PublicShell>
  );
}
