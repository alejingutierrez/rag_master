import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { periodInfo } from "@/lib/design-tokens";
import type { EntityNode, EntityPieceRef, EntityRelation } from "@/lib/public-data";
import { ENTITY_TYPE_META } from "@/lib/public-data";
import "@/components/public/article.css";
import "@/components/public/wiki.css";
import { imageAt } from "@/lib/image-url";

const KIND_LABEL: Record<string, string> = {
  hecho: "Hecho",
  epoca: "Época",
  entidad: "Entidad",
  pregunta: "Ensayo",
  ensayo: "Ensayo",
};

function yearLabel(anio: number | null): string {
  if (anio == null) return "—";
  return anio < 0 ? `${-anio} a.C.` : String(anio);
}

/** Cuántas piezas se ven sin desplegar; el resto queda en el <details>. */
const PIEZAS_VISIBLES = 4;

/** Una pieza donde aparece la entidad: año · título · tipo, en una sola línea. */
function PieceRow({ p }: { p: EntityPieceRef }) {
  return (
    <Link href={p.href} className="wiki-mini-row" title={p.titulo}>
      <span className="y">{yearLabel(p.anio)}</span>
      <span className="t">{p.titulo}</span>
      <span className="k">{KIND_LABEL[p.kind] ?? p.kind}</span>
    </Link>
  );
}

/**
 * Conexiones de una entidad: dónde aparece (piezas) y con qué otras entidades
 * co-ocurre (relaciones automáticas). Es la wikización — se teje sola.
 *
 * "Aparece en" es APARATO LATERAL, no cuerpo del artículo: una línea por pieza y
 * solo las primeras; el resto se pliega en un <details> nativo (sin JS). Antes se
 * volcaba la lista completa —decenas de entradas en lugares como Bogotá— y se
 * comía la página.
 */
export function EntityConnections({
  pieces,
  related,
  selfHref,
}: {
  pieces: EntityPieceRef[];
  related: EntityRelation[];
  /** Ruta de esta misma entidad: su propia pieza no se lista como "aparición". */
  selfHref?: string;
}) {
  const otras = selfHref ? pieces.filter((p) => p.href !== selfHref) : pieces;
  if (otras.length === 0 && related.length === 0) return null;
  const visibles = otras.slice(0, PIEZAS_VISIBLES);
  const resto = otras.slice(PIEZAS_VISIBLES);
  return (
    <div className="wiki">
      {otras.length > 0 && (
        <section className="wiki-sec">
          <div className="wiki-sec-h">
            <span className="wiki-sec-t">Aparece en</span>
            <span className="wiki-sec-n">{otras.length}</span>
          </div>
          <div className="wiki-mini">
            {visibles.map((p) => (
              <PieceRow key={p.href + p.titulo} p={p} />
            ))}
          </div>
          {resto.length > 0 && (
            <details className="wiki-more">
              <summary>
                Ver {resto.length === 1 ? "la restante" : `las ${resto.length} restantes`}
              </summary>
              <div className="wiki-mini">
                {resto.map((p) => (
                  <PieceRow key={p.href + p.titulo} p={p} />
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {related.length > 0 && (
        <section className="wiki-sec">
          <div className="wiki-sec-h">
            <span className="wiki-sec-t">Relacionadas</span>
            <span className="wiki-sec-n">por co-ocurrencia</span>
          </div>
          <div className="wiki-chips">
            {related.map((r) => (
              <Link key={r.type + r.slug} href={r.href} className="wiki-chip" title={`${ENTITY_TYPE_META[r.type].singular} · ${r.shared} ${r.shared === 1 ? "pieza compartida" : "piezas compartidas"}`}>
                <span className="dot" style={{ background: ENTITY_TYPE_META[r.type].color }} />
                {r.name}
                {r.shared > 1 && <span className="c">{r.shared}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Nodo wiki de una entidad SIN ficha curada: cabecera + conexiones. Usa el mismo
 * chrome editorial que las fichas para que se sienta parte del mismo sistema.
 */
export function EntityNodeArticle({
  node,
  crumb,
}: {
  node: EntityNode;
  crumb: { href: string; label: string };
}) {
  const meta = ENTITY_TYPE_META[node.type];
  const periodLabels = node.periods
    .map((c) => periodInfo(c)?.label)
    .filter((x): x is string => !!x);
  // La portada producida de la entidad. Un retrato de persona va al lado del
  // título (alineado arriba, para no cortar la cabeza); una vista de lugar o de
  // idea va apaisada bajo la cabecera — igual que en las fichas.
  const esRetrato = node.type === "persona";
  const retratoAlLado = esRetrato && !!node.imageUrl;

  const head = (
    <header className="art-head">
      <div className="art-kick">
        <span className="art-dot" style={{ background: ENTITY_TYPE_META[node.type].color }} />
        <span className="art-klabel">
          {meta.singular}
          {node.mentions > 0
            ? ` · ${node.mentions} ${node.mentions === 1 ? "aparición" : "apariciones"}`
            : ""}
        </span>
      </div>
      <h1 className="art-title">{node.name}</h1>
      {node.resumen && <p className="art-stand">{node.resumen}</p>}
      {periodLabels.length > 0 && (
        <div className="art-meta">Presente en: {periodLabels.join(" · ")}</div>
      )}
    </header>
  );

  return (
    <PublicShell>
      <div className="art-wrap">
        <div className="art-crumb">
          <Link href={crumb.href}>{crumb.label}</Link> · {meta.singular}
        </div>

        {retratoAlLado ? (
          <div className="art-head-row">
            {head}
            <figure className="art-figure portrait art-figure-side">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageAt(node.imageUrl, 640)!} alt={node.name} loading="lazy" />
            </figure>
          </div>
        ) : (
          <>
            {head}
            {node.imageUrl && (
              <figure className="art-figure landscape">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageAt(node.imageUrl, 1400)!} alt={node.name} loading="lazy" />
              </figure>
            )}
          </>
        )}

        <EntityConnections pieces={node.pieces} related={node.related} selfHref={node.href} />

        <div className="art-paso">
          <Link href={crumb.href}>
            <div className="pl">Seguir explorando</div>
            <div className="pn">
              {crumb.label} <span style={{ color: "var(--accent)" }}>→</span>
            </div>
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
