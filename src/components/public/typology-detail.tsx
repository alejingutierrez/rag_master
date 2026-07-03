import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { renderProse } from "@/components/public/prose";
import { getPeriodColor, periodInfo } from "@/lib/design-tokens";
import { typologyLabel, type StructuredData, type Hito } from "@/lib/typology-schemas";
import type { TypologyDetail } from "@/lib/public-data";
import "@/components/public/article.css";

const INDEX_HREF: Record<StructuredData["typology"], { href: string; label: string }> = {
  hecho: { href: "/hechos", label: "Hechos" },
  epoca: { href: "/epocas", label: "Épocas" },
  entidad: { href: "/entidades", label: "Entidades" },
  pregunta: { href: "/preguntas", label: "Preguntas" },
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

function Ficha({ s }: { s: StructuredData }) {
  switch (s.typology) {
    case "hecho":
      return (
        <div className="ficha">
          {s.fecha && <Row k="Fecha">{s.fecha}</Row>}
          {s.lugares.length > 0 && (
            <Row k="Lugares">
              <Tags items={s.lugares} />
            </Row>
          )}
          {s.protagonistas.length > 0 && (
            <Row k="Protagonistas">
              <Tags items={s.protagonistas} />
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
              <Tags items={s.actores} />
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
              <Tags items={s.relaciones} />
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
}: {
  detail: TypologyDetail;
  /** Contenido agregado (hub de época, conexiones de entidad) tras el cuerpo. */
  extra?: React.ReactNode;
  /** Sobrescribe el índice de retorno (p. ej. entidad → Personas). */
  crumb?: { href: string; label: string };
}) {
  const s = detail.structured;
  const idx = crumb ?? INDEX_HREF[s.typology];
  const dot = s.periodoCode ? getPeriodColor(s.periodoCode) : "var(--fg-dim)";
  const periodLabel = s.periodoCode ? periodInfo(s.periodoCode)?.label : null;
  const isPortrait = s.typology === "entidad" && s.tipo === "Persona";

  return (
    <PublicShell>
      <div className="art-wrap">
        <div className="art-crumb">
          <Link href={idx.href}>{idx.label}</Link> · {typologyLabel(s.typology)}
        </div>

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

        {detail.imageUrl && (
          <figure className={`art-figure ${isPortrait ? "portrait" : "landscape"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={detail.imageUrl} alt={s.titulo} loading="lazy" />
          </figure>
        )}

        <div className="art-body">
          <div>
            <Ficha s={s} />
            <div className="prose">{renderProse(detail.answer)}</div>
          </div>

          <aside className="art-apx">
            <span className="al">Aparato · fuentes</span>
            {detail.sources.length ? (
              detail.sources.map((src) => (
                <div key={src.n} className="art-src" id={`f${src.n}`}>
                  <span className="n">{src.n}</span>
                  <span className="t">
                    {src.label}
                    {src.page ? <span className="pg"> · p. {src.page}</span> : null}
                  </span>
                </div>
              ))
            ) : (
              <div className="art-src">
                <span className="t" style={{ gridColumn: "1 / -1" }}>
                  Producción de síntesis; fuentes en el corpus.
                </span>
              </div>
            )}
          </aside>
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
