import Link from "next/link";
import { getPeriodColor } from "@/lib/design-tokens";
import type { PeriodHub, HubPiece, EntityChip } from "@/lib/public-data";
import "@/components/public/wiki.css";

const KIND_LABEL: Record<string, string> = {
  hecho: "Hecho",
  pregunta: "Ensayo",
  ensayo: "Ensayo",
};

function yearLabel(anio: number | null): string {
  if (anio == null) return "—";
  return anio < 0 ? `${-anio} a.C.` : String(anio);
}

function PieceList({ items }: { items: HubPiece[] }) {
  return (
    <div className="wiki-list">
      {items.map((p) => (
        <Link key={p.href} href={p.href} className="wiki-item">
          <span className="y">{yearLabel(p.anio)}</span>
          <span>
            <span className="t">{p.titulo}</span>
            <span className="k">{KIND_LABEL[p.kind] ?? p.kind}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function ChipRow({ items, color }: { items: EntityChip[]; color: string }) {
  return (
    <div className="wiki-chips">
      {items.map((e) => (
        <Link key={e.slug} href={e.href} className="wiki-chip">
          <span className="dot" style={{ background: color }} />
          {e.name}
          {e.count > 1 && <span className="c">{e.count}</span>}
        </Link>
      ))}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="wiki-sec">
      <div className="wiki-sec-h">
        <span className="wiki-sec-t">{title}</span>
        {count != null && <span className="wiki-sec-n">{count}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Época como HUB: reúne todo lo publicado anclado al período (hechos, ensayos,
 * personas/lugares/ideas) + la entrada al timeline del período. Se vincula solo
 * a medida que se publican piezas — es la wikización de la época.
 */
export function PeriodHubSections({
  hub,
  periodCode,
}: {
  hub: PeriodHub;
  periodCode: string | null;
}) {
  const color = periodCode ? getPeriodColor(periodCode) : "var(--fg-dim)";
  const nothing =
    hub.hechos.length === 0 &&
    hub.ensayos.length === 0 &&
    hub.personas.length === 0 &&
    hub.lugares.length === 0 &&
    hub.ideas.length === 0;

  return (
    <div className="wiki">
      <div className="wiki-sec-h" style={{ borderTop: "2px solid var(--fg)" }}>
        <span className="wiki-sec-t" style={{ color: "var(--fg)", fontWeight: 600 }}>
          En esta época
        </span>
        {hub.pieceCount > 0 && (
          <span className="wiki-sec-n">
            {hub.pieceCount} {hub.pieceCount === 1 ? "pieza" : "piezas"}
          </span>
        )}
      </div>

      {nothing && (
        <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--fg-muted)", fontSize: 15, margin: "6px 0 0" }}>
          Todavía no hay más piezas publicadas de este período. Aparecerán aquí a medida que se publiquen.
        </p>
      )}

      {hub.hechos.length > 0 && (
        <Section title="Hechos" count={hub.hechos.length}>
          <PieceList items={hub.hechos} />
        </Section>
      )}
      {hub.ensayos.length > 0 && (
        <Section title="Ensayos" count={hub.ensayos.length}>
          <PieceList items={hub.ensayos} />
        </Section>
      )}
      {hub.personas.length > 0 && (
        <Section title="Personas" count={hub.personas.length}>
          <ChipRow items={hub.personas} color={color} />
        </Section>
      )}
      {hub.lugares.length > 0 && (
        <Section title="Lugares" count={hub.lugares.length}>
          <ChipRow items={hub.lugares} color={color} />
        </Section>
      )}
      {hub.ideas.length > 0 && (
        <Section title="Ideas" count={hub.ideas.length}>
          <ChipRow items={hub.ideas} color={color} />
        </Section>
      )}

      {periodCode && (
        <Link href={`/linea-de-tiempo?p=${periodCode}`} className="wiki-tl">
          Ver el período en la línea de tiempo →
        </Link>
      )}
    </div>
  );
}
