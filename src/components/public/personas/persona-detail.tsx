import Link from "next/link";
import {
  BookOpenText,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Landmark,
  MapPin,
} from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";
import { EntityConnections } from "@/components/public/entity-node";
import { groupEssaySources } from "@/components/public/hechos/source-bibliography";
import { renderProse } from "@/components/public/prose";
import { periodInfo } from "@/lib/design-tokens";
import type { EntityLinker } from "@/lib/entity-linker";
import type { EntityNode, TypologyDetail } from "@/lib/public-data";
import type { EntidadStructured } from "@/lib/typology-schemas";
import { PersonaFloatingPortrait } from "./persona-floating-portrait";
import { PersonaReadingRail, type PersonaRailItem } from "./persona-reading-rail";
import "@/components/public/article.css";
import "@/components/public/wiki.css";
import "./persona-detail.css";

const RAIL_ITEMS: PersonaRailItem[] = [
  { id: "pd-en-breve", label: "En breve" },
  { id: "pd-biografia", label: "La biografía" },
  { id: "pd-linea-vida", label: "Línea de vida" },
  { id: "pd-red-historica", label: "Red histórica" },
  { id: "pd-documentos", label: "Documentos" },
];

function yearIn(value: string | null): number | null {
  const match = value?.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return match ? Number(match[1]) : null;
}

function lifeRange(person: EntidadStructured): string | null {
  const birth = yearIn(person.nacimiento);
  const death = yearIn(person.muerte);
  if (birth && death) return `${birth}–${death}`;
  if (birth) return `N. ${birth}`;
  return null;
}

function splitBiography(markdown: string): { lead: string; body: string } {
  const lines = markdown.split("\n");
  const firstContent = lines.findIndex((line) => line.trim().length > 0);
  if (firstContent >= 0 && /^#\s+/.test(lines[firstContent])) lines.splice(firstContent, 1);
  const firstSection = lines.findIndex((line) => /^##\s+/.test(line));
  if (firstSection < 0) return { lead: lines.join("\n").trim(), body: "" };
  return {
    lead: lines.slice(0, firstSection).join("\n").trim(),
    body: lines.slice(firstSection).join("\n").trim(),
  };
}

function compactRole(roles: string[]): string {
  return roles.slice(0, 2).join(" · ") || "Figura histórica";
}

function pagesLabel(pages: number[]): string | null {
  if (!pages.length) return null;
  return pages.length === 1 ? `Página ${pages[0]}` : `Páginas ${pages.join(", ")}`;
}

function Fact({
  icon,
  label,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string | null;
}) {
  return (
    <div className="pd-fact">
      <span className="pd-fact-icon" aria-hidden>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{primary}</strong>
        {secondary ? <small>{secondary}</small> : null}
      </div>
    </div>
  );
}

function Timeline({ person }: { person: EntidadStructured }) {
  if (!person.hitos.length) return null;
  return (
    <section className="pd-timeline" id="pd-linea-vida" aria-labelledby="pd-timeline-title">
      <header className="pd-section-heading">
        <span>02</span>
        <h2 id="pd-timeline-title">Línea de vida</h2>
      </header>
      <ol>
        {person.hitos.map((milestone, index) => (
          <li key={`${milestone.year ?? "sin-fecha"}-${index}`}>
            <span className="pd-timeline-dot" aria-hidden />
            <strong>{milestone.year ?? "—"}</strong>
            <p>{milestone.titulo}</p>
            {milestone.detalle ? <details><summary>Leer contexto</summary><p>{milestone.detalle}</p></details> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function DocumentArchive({ detail }: { detail: TypologyDetail }) {
  const documents = groupEssaySources(detail.sources);
  return (
    <section className="pd-documents" id="pd-documentos" aria-labelledby="pd-documents-title">
      <header className="pd-section-heading">
        <span>05</span>
        <div>
          <p>Archivo documental</p>
          <h2 id="pd-documents-title">Documentos y fragmentos citados</h2>
          <small>{documents.length} documentos · {detail.sources.length} fragmentos</small>
        </div>
      </header>
      {documents.length ? (
        <div className="pd-document-list">
          {documents.map((document, index) => (
            <details key={document.key}>
              {document.sources.map((source) => <span id={`f${source.n}`} key={source.n} className="pd-source-anchor" aria-hidden />)}
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{document.title}</strong>
                <small>{[document.author, document.publicationYear, pagesLabel(document.pages)].filter(Boolean).join(" · ") || "Documento del corpus"}</small>
                <i>{document.sources.length} {document.sources.length === 1 ? "cita" : "citas"}</i>
              </summary>
              <div className="pd-document-fragments">
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
      ) : <p className="pd-documents-empty">Esta biografía conserva sus fuentes en el corpus editorial.</p>}
    </section>
  );
}

export function PersonaDetailArticle({
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
  if (detail.structured.typology !== "entidad" || detail.structured.tipo !== "Persona") return null;
  const person = detail.structured;
  const period = person.periodoCode ? periodInfo(person.periodoCode) : null;
  const range = lifeRange(person);
  const readingMinutes = Math.max(1, Math.ceil(detail.wordCount / 220));
  const documents = groupEssaySources(detail.sources);
  const biography = splitBiography(detail.answer);

  return (
    <PublicShell>
      <article className="pd-page" data-persona-article>
        <div className="pd-shell">
          <div className="pd-persona-layout">
            <section className="pd-hero" aria-labelledby="pd-title">
              <header className="pd-hero-copy">
                <Link href="/personas" className="pd-kicker">Biografía</Link>
                <h1 id="pd-title">{person.titulo}</h1>
                <span className="pd-title-rule" aria-hidden />
                {period ? <p className="pd-period">{period.label}</p> : null}
                {range ? <p className="pd-life-range">{range}</p> : null}
                <div className="pd-hero-meta">
                  <span><BookOpenText aria-hidden />{readingMinutes} min de lectura</span>
                  <span><FileText aria-hidden />{documents.length} {documents.length === 1 ? "documento" : "documentos"}</span>
                </div>
              </header>
            </section>

            <PersonaFloatingPortrait imageUrl={detail.imageUrl} title={person.titulo} />

            <section className="pd-facts" id="pd-en-breve" aria-label="Datos biográficos principales">
              <Fact icon={<CalendarDays />} label="Nacimiento" primary={person.nacimiento ?? "Sin fecha registrada"} />
              <Fact icon={<Landmark />} label="Fallecimiento" primary={person.muerte ?? "Sin fecha registrada"} />
              <Fact icon={<BriefcaseBusiness />} label="Roles" primary={compactRole(person.roles)} />
              <Fact icon={<MapPin />} label="Lugar principal" primary={person.lugarPrincipal ?? "Colombia"} />
              <Fact icon={<BookOpenText />} label="Período histórico" primary={period?.label ?? "Transversal"} secondary={period?.yearRange} />
            </section>

            <div className="pd-reading-grid">
              <PersonaReadingRail items={RAIL_ITEMS} readingMinutes={readingMinutes} />
              <main className="pd-article-column">
                <section className="pd-biography-lead" id="pd-biografia" aria-labelledby="pd-biography-title">
                  <header className="pd-section-heading">
                    <span>03</span>
                    <h2 id="pd-biography-title">La biografía</h2>
                  </header>
                  <div className="pd-prose pd-prose-lead">
                    {renderProse(biography.lead || person.resumen, { linker, selfKey, headingPrefix: "pd-lead-" })}
                  </div>
                </section>

                <Timeline person={person} />

                {biography.body ? (
                  <div className="pd-prose pd-prose-body">
                    {renderProse(biography.body, { linker, selfKey, headingPrefix: "pd-bio-" })}
                  </div>
                ) : null}

                <section className="pd-network" id="pd-red-historica" aria-labelledby="pd-network-title">
                  <header className="pd-section-heading">
                    <span>04</span>
                    <div>
                      <p>Conexiones del archivo</p>
                      <h2 id="pd-network-title">Red histórica</h2>
                    </div>
                  </header>
                  <EntityConnections pieces={node.pieces} related={node.related} selfHref={node.href} />
                </section>

                <DocumentArchive detail={detail} />
              </main>
            </div>
          </div>
        </div>
      </article>
    </PublicShell>
  );
}
