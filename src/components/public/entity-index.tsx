"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import type { PublicEntity } from "@/lib/public-data";
import "@/components/public/typology-index.css";
import "@/components/public/wiki.css";

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Índice filtrable de entidades de un tipo (personas / lugares / ideas). */
export function EntityBrowser({
  entities,
  kicker,
  title,
  intro,
  emptyNote,
  typeLabel,
  color,
}: {
  entities: PublicEntity[];
  kicker: string;
  title: string;
  intro: string;
  emptyNote: string;
  typeLabel: string;
  color: string;
}) {
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [q, setQ] = useState("");

  // Épocas presentes, en orden cronológico (por el periodoOrden mínimo de la entidad).
  const periods = useMemo(() => {
    const seen = new Map<string, number>();
    for (const e of entities) {
      for (const code of e.periods) {
        if (!seen.has(code)) seen.set(code, e.periodoOrden);
      }
    }
    return [...seen.entries()]
      .sort((a, b) => (PERIODS[a[0] as PeriodCode] ? 0 : 1) - (PERIODS[b[0] as PeriodCode] ? 0 : 1) || a[1] - b[1])
      .map(([code]) => code)
      .filter((code) => PERIODS[code as PeriodCode]);
  }, [entities]);

  const nq = norm(q.trim());
  const filtered = useMemo(
    () =>
      entities.filter((e) => {
        if (periodo && !e.periods.includes(periodo)) return false;
        if (nq && !norm(`${e.name} ${e.resumen ?? ""}`).includes(nq)) return false;
        return true;
      }),
    [entities, periodo, nq],
  );

  const showFilters = entities.length >= 6;

  return (
    <div className="tix-wrap">
      <header className="tix-head">
        <div className="tix-kick">{kicker}</div>
        <h1 className="tix-title">{title}</h1>
        <p className="tix-intro">{intro}</p>
      </header>

      {showFilters && (
        <div className="tix-filters">
          {periods.length >= 2 && (
            <div className="tix-chips">
              <button
                type="button"
                className={"tix-chip" + (periodo === null ? " is-active" : "")}
                onClick={() => setPeriodo(null)}
              >
                Todas
              </button>
              {periods.map((code) => {
                const p = PERIODS[code as PeriodCode];
                const active = periodo === code;
                return (
                  <button
                    key={code}
                    type="button"
                    className={"tix-chip" + (active ? " is-active" : "")}
                    onClick={() => setPeriodo(active ? null : code)}
                  >
                    {p?.label ?? code}
                  </button>
                );
              })}
            </div>
          )}
          <div className="tix-searchrow">
            <SearchInput value={q} onChange={setQ} placeholder={`Buscar ${title.toLowerCase()}…`} width={260} />
          </div>
        </div>
      )}

      <div className="tix-count">
        {filtered.length === entities.length
          ? `${entities.length} ${entities.length === 1 ? "registrada" : "registradas"}`
          : `${filtered.length} de ${entities.length}`}
      </div>

      {entities.length === 0 ? (
        <div className="tix-empty">{emptyNote}</div>
      ) : filtered.length === 0 ? (
        <div className="tix-empty">
          Nada coincide con el filtro.{" "}
          <button type="button" className="tix-clear" onClick={() => { setPeriodo(null); setQ(""); }}>
            Limpiar
          </button>
        </div>
      ) : (
        <ul className="ent-grid">
          {filtered.map((e) => (
            <li key={e.slug} className="ent-card">
              <Link href={e.href}>
                <div className="ent-kmeta">
                  <span className="dot" style={{ background: color }} />
                  {typeLabel} · {e.mentions} {e.mentions === 1 ? "aparición" : "apariciones"}
                </div>
                <div className="ent-name">{e.name}</div>
                {e.resumen && <div className="ent-sum">{e.resumen}</div>}
                {e.hasFicha && <span className="ent-ficha">✦ Con ficha</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
