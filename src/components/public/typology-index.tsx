import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { getPeriodColor } from "@/lib/design-tokens";
import type { TypologyCard } from "@/lib/public-data";
import "@/components/public/typology-index.css";

export function TypologyIndex({
  kicker,
  title,
  intro,
  cards,
  emptyNote,
}: {
  kicker: string;
  title: string;
  intro: string;
  cards: TypologyCard[];
  emptyNote: string;
}) {
  return (
    <PublicShell>
      <div className="tix-wrap">
        <header className="tix-head">
          <div className="tix-kick">{kicker}</div>
          <h1 className="tix-title">{title}</h1>
          <p className="tix-intro">{intro}</p>
          <div className="tix-count">
            {cards.length} {cards.length === 1 ? "publicada" : "publicadas"}
          </div>
        </header>

        {cards.length === 0 ? (
          <div className="tix-empty">{emptyNote}</div>
        ) : (
          <ul className="tix-grid">
            {cards.map((c) => {
              const dot = c.periodCode ? getPeriodColor(c.periodCode) : "var(--fg-dim)";
              return (
                <li key={c.id} className="tix-card">
                  <Link href={c.href}>
                    {c.imageUrl && (
                      <div className="tix-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.imageUrl} alt={c.titulo} loading="lazy" />
                      </div>
                    )}
                    <div className="tix-kmeta">
                      <span className="tix-dot" style={{ background: dot }} />
                      {c.meta ?? " "}
                    </div>
                    <div className="tix-ct">{c.titulo}</div>
                    {c.resumen && <div className="tix-cr">{c.resumen}</div>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PublicShell>
  );
}
