"use client";

import { useState } from "react";
import Link from "next/link";

interface DirectoryEntry {
  name: string;
  href: string;
  mentions: number;
}

interface DirectoryGroup {
  key: "personas" | "lugares" | "ideas";
  label: string;
  href: string;
  count: number;
  entries: DirectoryEntry[];
}

function Arrow() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="hp-arrow">
      <path d="M3 9h11M10 4l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  );
}

export function ConnectedDirectory({ groups }: { groups: DirectoryGroup[] }) {
  const [selected, setSelected] = useState<DirectoryGroup["key"]>("personas");

  return (
    <div className="hp-directory">
      <div className="hp-directory-tabs" role="tablist" aria-label="Tipo de entidad">
        {groups.map((group) => (
          <button
            key={group.key}
            type="button"
            role="tab"
            aria-selected={selected === group.key}
            className={selected === group.key ? "is-active" : ""}
            onClick={() => setSelected(group.key)}
          >
            {group.label} <span>{group.count}</span>
          </button>
        ))}
      </div>

      <div className="hp-directory-grid">
        {groups.map((group) => (
          <section
            key={group.key}
            className={`hp-directory-group ${selected === group.key ? "is-active" : ""}`}
            role="tabpanel"
          >
            {/* El directorio solo lista lo que tiene artículo propio publicado:
                el rótulo dice eso y no «mencionadas», que era el mundo anterior. */}
            <div className="hp-directory-title">
              <div><strong>{group.count}</strong> {group.label.toLowerCase()} con historia propia</div>
              <span>Orden por presencia en el archivo</span>
            </div>
            <ol>
              {group.entries.map((entry) => (
                <li key={entry.href}>
                  <Link href={entry.href}>
                    <span>{entry.name}</span>
                    <small>{entry.mentions} {entry.mentions === 1 ? "pieza" : "piezas"}</small>
                    <Arrow />
                  </Link>
                </li>
              ))}
            </ol>
            <Link href={group.href} className="hp-directory-all">
              Ver directorio <Arrow />
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}
