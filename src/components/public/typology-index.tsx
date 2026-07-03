import { PublicShell } from "@/components/public/public-shell";
import { TypologyBrowser } from "@/components/public/typology-browser";
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
        </header>

        <TypologyBrowser cards={cards} emptyNote={emptyNote} />
      </div>
    </PublicShell>
  );
}
