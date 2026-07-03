import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { periodInfo } from "@/lib/design-tokens";
import type { EntityNode, EntityPieceRef, EntityRelation } from "@/lib/public-data";
import { ENTITY_TYPE_META } from "@/lib/public-data";
import "@/components/public/article.css";
import "@/components/public/wiki.css";

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

/**
 * Conexiones de una entidad: dónde aparece (piezas) y con qué otras entidades
 * co-ocurre (relaciones automáticas). Es la wikización — se teje sola.
 */
export function EntityConnections({
  pieces,
  related,
}: {
  pieces: EntityPieceRef[];
  related: EntityRelation[];
}) {
  if (pieces.length === 0 && related.length === 0) return null;
  return (
    <div className="wiki">
      {pieces.length > 0 && (
        <section className="wiki-sec">
          <div className="wiki-sec-h">
            <span className="wiki-sec-t">Aparece en</span>
            <span className="wiki-sec-n">{pieces.length}</span>
          </div>
          <div className="wiki-list">
            {pieces.map((p) => (
              <Link key={p.href + p.titulo} href={p.href} className="wiki-item">
                <span className="y">{yearLabel(p.anio)}</span>
                <span>
                  <span className="t">{p.titulo}</span>
                  <span className="k">{KIND_LABEL[p.kind] ?? p.kind}</span>
                </span>
              </Link>
            ))}
          </div>
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

  return (
    <PublicShell>
      <div className="art-wrap">
        <div className="art-crumb">
          <Link href={crumb.href}>{crumb.label}</Link> · {meta.singular}
        </div>

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

        <EntityConnections pieces={node.pieces} related={node.related} />

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
