import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { SourceApparatus } from "@/components/public/source-apparatus";
import { renderProse } from "@/components/public/prose";
import { getPeriodColor, periodInfo } from "@/lib/design-tokens";
import { typologyLabel, type StructuredData, type Hito } from "@/lib/typology-schemas";
import type { ResolvedEntityChip, TypologyDetail } from "@/lib/public-data";
import type { EntityLinker } from "@/lib/entity-linker";
import "@/components/public/article.css";
import { imageAt } from "@/lib/image-url";

/** Chips de entidad ya resueltos por la página, por rol dentro de la ficha. */
export interface FichaChips {
  protagonistas?: ResolvedEntityChip[];
  lugares?: ResolvedEntityChip[];
  actores?: ResolvedEntityChip[];
  relaciones?: ResolvedEntityChip[];
}

const INDEX_HREF: Record<StructuredData["typology"], { href: string; label: string }> = {
  hecho: { href: "/hechos", label: "Hechos" },
  epoca: { href: "/epocas", label: "Épocas" },
  entidad: { href: "/entidades", label: "Entidades" },
  // El índice de /ensayos se llama «Lecturas» en toda la navegación: la miga y el
  // pie de la ficha tienen que llamarlo igual.
  pregunta: { href: "/ensayos", label: "Lecturas" },
};

function Tags({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="ficha-tags">
      {items.map((t, i) => (
        <span key={i} className="ficha-tag">
          {t}
        </span>
      ))}
    </div>
  );
}

/**
 * Entidades nombradas por la ficha. Las que tienen artículo propio se vuelven un
 * enlace con su retrato; las demás quedan como texto. Así el lector distingue de
 * un vistazo por dónde puede seguir leyendo, y ningún enlace muere en una página
 * vacía. Sustituye a los <Tags> mudos que había antes.
 */
function EntityChips({ chips, fallback }: { chips?: ResolvedEntityChip[]; fallback: string[] }) {
  if (!chips?.length) return <Tags items={fallback} />;
  return (
    <div className="ficha-chips">
      {chips.map((c) =>
        c.href ? (
          <Link key={c.name} href={c.href} className="ficha-chip is-linked">
            {c.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageAt(c.imageUrl, 160)!} alt="" aria-hidden loading="lazy" />
            ) : (
              <span className="ficha-chip-dot" aria-hidden />
            )}
            <span>{c.name}</span>
          </Link>
        ) : (
          <span key={c.name} className="ficha-chip">
            {c.name}
          </span>
        ),
      )}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="ficha-row">
      <div className="ficha-k">{k}</div>
      <div className="ficha-v">{children}</div>
    </div>
  );
}

function Hitos({ hitos }: { hitos: Hito[] }) {
  if (!hitos.length) return null;
  return (
    <ol className="ficha-hitos">
      {hitos.map((h, i) => (
        <li key={i}>
          {h.year != null && <span className="hy">{h.year}</span>}
          <span className="ht">
            {h.titulo}
            {h.detalle ? <span className="hd"> — {h.detalle}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Ficha({ s, chips }: { s: StructuredData; chips?: FichaChips }) {
  switch (s.typology) {
    case "hecho":
      return (
        <div className="ficha">
          {s.fecha && <Row k="Fecha">{s.fecha}</Row>}
          {s.lugares.length > 0 && (
            <Row k="Lugares">
              <EntityChips chips={chips?.lugares} fallback={s.lugares} />
            </Row>
          )}
          {s.protagonistas.length > 0 && (
            <Row k="Protagonistas">
              <EntityChips chips={chips?.protagonistas} fallback={s.protagonistas} />
            </Row>
          )}
          {s.causas.length > 0 && (
            <Row k="Causas">
              <ul className="ficha-list">
                {s.causas.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Row>
          )}
          {s.consecuencias.length > 0 && (
            <Row k="Consecuencias">
              <ul className="ficha-list">
                {s.consecuencias.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Row>
          )}
          {s.porQueImporta && <Row k="Por qué importa">{s.porQueImporta}</Row>}
        </div>
      );
    case "epoca":
      return (
        <div className="ficha">
          {s.rango && <Row k="Años">{s.rango}</Row>}
          {s.panorama && <Row k="Panorama">{s.panorama}</Row>}
          {s.hitos.length > 0 && (
            <Row k="Hitos">
              <Hitos hitos={s.hitos} />
            </Row>
          )}
          {s.actores.length > 0 && (
            <Row k="Actores">
              <EntityChips chips={chips?.actores} fallback={s.actores} />
            </Row>
          )}
          {s.transformaciones.length > 0 && (
            <Row k="Transformaciones">
              <Tags items={s.transformaciones} />
            </Row>
          )}
          {s.legado && <Row k="Legado">{s.legado}</Row>}
        </div>
      );
    case "entidad":
      return (
        <div className="ficha">
          <Row k="Tipo">{s.tipo}</Row>
          {(s.nacimiento || s.muerte) && (
            <Row k="Vida">
              {[s.nacimiento, s.muerte].filter(Boolean).join(" — ")}
            </Row>
          )}
          {s.roles.length > 0 && (
            <Row k="Roles">
              <Tags items={s.roles} />
            </Row>
          )}
          {s.hitos.length > 0 && (
            <Row k="Hitos">
              <Hitos hitos={s.hitos} />
            </Row>
          )}
          {s.relaciones.length > 0 && (
            <Row k="Relaciones">
              <EntityChips chips={chips?.relaciones} fallback={s.relaciones} />
            </Row>
          )}
          {s.semblanza && <Row k="Semblanza">{s.semblanza}</Row>}
        </div>
      );
    case "pregunta":
      return (
        <div className="ficha">
          {s.tesis && <Row k="Tesis">{s.tesis}</Row>}
          {s.debate && <Row k="En debate">{s.debate}</Row>}
          {s.temasRelacionados.length > 0 && (
            <Row k="Temas">
              <Tags items={s.temasRelacionados} />
            </Row>
          )}
        </div>
      );
  }
}

export function TypologyArticle({
  detail,
  extra,
  crumb,
  linker,
  selfKey,
  chips,
}: {
  detail: TypologyDetail;
  /** Contenido agregado (hub de época, conexiones de entidad) tras el cuerpo. */
  extra?: React.ReactNode;
  /** Sobrescribe el índice de retorno (p. ej. entidad → Personas). */
  crumb?: { href: string; label: string };
  /** Diccionario para auto-enlazar entidades mencionadas en la prosa. */
  linker?: EntityLinker | null;
  /** `${type}:${slug}` de la entidad de esta página — no se auto-enlaza a sí misma. */
  selfKey?: string;
  /** Entidades de la ficha ya resueltas a enlace+retrato (ver resolveEntityChips). */
  chips?: FichaChips;
}) {
  const s = detail.structured;
  const idx = crumb ?? INDEX_HREF[s.typology];
  const dot = s.periodoCode ? getPeriodColor(s.periodoCode) : "var(--fg-dim)";
  const periodLabel = s.periodoCode ? periodInfo(s.periodoCode)?.label : null;
  const isPortrait = s.typology === "entidad" && s.tipo === "Persona";
  // Retrato de persona: la foto va a la DERECHA del título (y alineada arriba, en
  // CSS, para no cortar la cabeza). El resto de imágenes van full-width bajo el
  // encabezado.
  const portraitAside = isPortrait && !!detail.imageUrl;

  const head = (
    <header className="art-head">
      <div className="art-kick">
        <span className="art-dot" style={{ background: dot }} />
        <span className="art-klabel">
          {typologyLabel(s.typology)}
          {periodLabel ? ` · ${periodLabel}` : ""}
          {detail.yearRange ? ` · ${detail.yearRange}` : ""}
        </span>
      </div>
      <h1 className="art-title">{s.titulo}</h1>
      {s.resumen && <p className="art-stand">{s.resumen}</p>}
      <div className="art-meta">
        <b>Alejandro Gutiérrez</b> · {detail.dateLabel} ·{" "}
        {detail.wordCount.toLocaleString("es-CO")} palabras
        {detail.sources.length ? ` · ${detail.sources.length} fuentes` : ""}
      </div>
    </header>
  );

  return (
    <PublicShell>
      <div className="art-wrap">
        <div className="art-crumb">
          <Link href={idx.href}>{idx.label}</Link> · {typologyLabel(s.typology)}
        </div>

        {portraitAside ? (
          <div className="art-head-row">
            {head}
            <figure className="art-figure portrait art-figure-side">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageAt(detail.imageUrl, 640)!} alt={s.titulo} loading="lazy" />
            </figure>
          </div>
        ) : (
          <>
            {head}
            {detail.imageUrl && (
              <figure className="art-figure landscape">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageAt(detail.imageUrl, 1400)!} alt={s.titulo} loading="lazy" />
              </figure>
            )}
          </>
        )}

        <div className="art-body">
          <div>
            <Ficha s={s} chips={chips} />
            <div className="prose">{renderProse(detail.answer, { linker, selfKey })}</div>
          </div>

          <SourceApparatus sources={detail.sources} />
        </div>

        {extra}

        <div className="art-paso">
          <Link href={idx.href}>
            <div className="pl">Seguir explorando</div>
            <div className="pn">
              {idx.label} <span style={{ color: "var(--accent)" }}>→</span>
            </div>
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
