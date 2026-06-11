"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  FilterTabs,
  SearchInput,
  EmptyState,
} from "@/components/editorial";

type TypeFilter = "all" | "person" | "place" | "concept";

interface Entity {
  name: string;
  mentions: number;
  docCount: number;
  questionCount?: number;
  type: "person" | "place" | "concept";
}

export default function EntitiesPage() {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [counts, setCounts] = useState({ all: 0, person: 0, place: 0, concept: 0 });
  const [type, setType] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    const p = new URLSearchParams({ limit: "200", minMentions: "2" });
    if (type !== "all") p.set("type", type);
    fetch(`/api/entities?${p}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { entities: [] }))
      .then((data) => {
        setEntities(data.entities ?? []);
        // Conteos estables desde el servidor (independientes de la pestaña).
        if (data.counts) setCounts(data.counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [type]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? entities.filter((e) => e.name.toLowerCase().includes(q))
      : entities;
    return list.slice().sort((a, b) => b.mentions - a.mentions);
  }, [entities, search]);

  const max = useMemo(
    () => Math.max(1, ...entities.map((e) => e.mentions)),
    [entities],
  );

  return (
    <div className="fade-up" data-screen-label="Entities">
      <PageHeader
        label={`Exploración · ${counts.all} entidades`}
        title="Entidades"
        italic="del corpus"
        subtitle="Personas, lugares y conceptos extraídos de las preguntas generadas. Tamaño = nº de menciones."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section
        style={{
          padding: "20px 56px",
          maxWidth: 1320,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <FilterTabs<TypeFilter>
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: `Todas · ${counts.all}` },
            { value: "person", label: `Personas · ${counts.person}` },
            { value: "place", label: `Lugares · ${counts.place}` },
            { value: "concept", label: `Conceptos · ${counts.concept}` },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar entidad…" />
      </section>

      <section style={{ padding: "32px 56px 96px", maxWidth: 1320 }}>
        {loading && (
          <div style={{ paddingTop: 16, borderTop: "1px solid var(--line-strong)" }}>
            <div className="shimmer-line" style={{ height: 24, width: "70%" }} />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <EmptyState
            title="Sin entidades"
            hint="Genera preguntas para extraer entidades del corpus."
          />
        )}
        {!loading && filtered.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "20px 28px",
              alignItems: "baseline",
              paddingTop: 16,
              borderTop: "1px solid var(--line-strong)",
            }}
          >
            {filtered.map((e) => {
              const w = e.mentions / max;
              const fontSize = 16 + w * 36;
              return (
                <button
                  key={e.name}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/questions?entity=${encodeURIComponent(e.name)}&entityType=${e.type}`,
                    )
                  }
                  style={{
                    appearance: "none",
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                    fontFamily: "var(--font-display)",
                    fontSize,
                    lineHeight: 1.0,
                    color: "var(--fg)",
                    letterSpacing: "-0.015em",
                    transition: "color 140ms var(--ease-out-custom)",
                  }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.color = "var(--accent)")}
                  onMouseLeave={(ev) => (ev.currentTarget.style.color = "var(--fg)")}
                  title={`${e.mentions} menciones en ${e.docCount} documentos`}
                >
                  {e.type === "place" ? <em>{e.name}</em> : e.name}
                  <sub
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: "var(--fg-faint)",
                      marginLeft: 4,
                      fontStyle: "normal",
                      position: "relative",
                      top: -fontSize * 0.4,
                    }}
                  >
                    {e.mentions}
                  </sub>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
