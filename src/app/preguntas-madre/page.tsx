"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import Link from "next/link";
import {
  PageHeader,
  Pill,
  SearchInput,
  EmptyState,
  PeriodTag,
  primaryBtn,
  ghostBtn,
} from "@/components/editorial";
import { PERIODS, CATEGORIES, type PeriodCode, type CategoryCode } from "@/lib/design-tokens";

interface Master {
  id: string;
  periodoCode: PeriodCode;
  categoriaCode: CategoryCode;
  pregunta: string;
  problemaSubyacente: string;
  tesisEnTension: Array<{ tesis?: string; libro?: string } | string>;
  tipoPregunta: string | null;
  escalaGeografica: string | null;
  gateScore: number;
  status: string;
  childCount: number;
  bookCount: number;
}

interface Child {
  id: string; pregunta: string; subcategoria: string | null;
  hipotesis: string | null; libro: string | null; isPrimary: boolean;
}

const FORMATS = [
  { id: "cronica", label: "Crónica histórica" },
  { id: "ensayo-autor", label: "Ensayo de autor" },
  { id: "reportaje", label: "Reportaje" },
  { id: "capitulo", label: "Capítulo" },
];

const PERIOD_CODES = Object.keys(PERIODS) as PeriodCode[];
const CATEGORY_CODES = Object.keys(CATEGORIES) as CategoryCode[];

export default function PreguntasMadrePage() {
  const [items, setItems] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<{ total: number; byPeriodo: { periodoCode: string; count: number }[] } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "40", includeStats: "true" });
    if (periodo) p.set("periodo", periodo);
    if (categoria) p.set("categoria", categoria);
    if (search) p.set("search", search);
    (async () => {
      try {
        const r = await fetch(`/api/preguntas-madre?${p}`);
        const d = r.ok ? await r.json() : { items: [], pagination: { totalPages: 1 } };
        if (cancelled) return;
        setItems(d.items ?? []);
        setTotalPages(d.pagination?.totalPages ?? 1);
        if (d.stats) setStats(d.stats);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, periodo, categoria, search]);

  useEffect(() => { setPage(1); }, [periodo, categoria, search]);

  return (
    <div className="fade-up" data-screen-label="Preguntas Madre">
      <PageHeader
        label="Investigación · Capa de consolidación"
        title="Preguntas"
        italic="madre"
        subtitle={
          stats
            ? `${stats.total} preguntas-madre que sintetizan, cruzando libros, las preguntas de cada período. La unidad para producir en masa.`
            : "Síntesis cross-libro de las preguntas de investigación."
        }
      />
      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section style={{ padding: "20px 56px 96px", maxWidth: 1320 }}>
        <div style={{ marginBottom: 16, maxWidth: 520 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar en pregunta o problema…" />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <Pill active={!periodo} onClick={() => setPeriodo("")}>Todos los períodos</Pill>
          {PERIOD_CODES.map((c) => (
            <Pill key={c} active={periodo === c} onClick={() => setPeriodo(c)}>
              {PERIODS[c].short}
            </Pill>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
          <Pill active={!categoria} onClick={() => setCategoria("")}>Todas las categorías</Pill>
          {CATEGORY_CODES.map((c) => (
            <Pill key={c} active={categoria === c} onClick={() => setCategoria(c)}>
              {CATEGORIES[c].short}
            </Pill>
          ))}
        </div>

        {loading && <div style={{ color: "var(--fg-muted)", padding: "40px 0" }}>Cargando…</div>}

        {!loading && items.length === 0 && (
          <EmptyState
            title="Aún no hay preguntas-madre para este filtro"
            hint="La capa se genera y se carga como borradores (DRAFT) para curar."
          />
        )}

        {!loading && items.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((m, idx) => {
              const showHeader = idx === 0 || items[idx - 1].periodoCode !== m.periodoCode;
              const pInfo = PERIODS[m.periodoCode];
              return (
              <Fragment key={m.id}>
              {showHeader && (
                <li style={{ listStyle: "none", padding: "30px 0 6px", display: "flex", alignItems: "baseline", gap: 12, borderTop: idx === 0 ? "none" : "1px solid var(--line-strong)" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: `var(--p-${pInfo?.slug})`, display: "inline-block", alignSelf: "center" }} />
                  <span className="display-italic" style={{ fontSize: 22, color: "var(--fg)" }}>{pInfo?.label ?? m.periodoCode}</span>
                  <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{pInfo?.yearRange}</span>
                </li>
              )}
              <li style={{ borderBottom: "1px solid var(--line)", padding: "18px 0" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                  <button
                    onClick={() => setOpenId(openId === m.id ? null : m.id)}
                    style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", flex: 1, padding: 0 }}
                  >
                    <div style={{ fontSize: 16, lineHeight: 1.5, color: "var(--fg)", fontWeight: 500 }}>
                      {m.pregunta}
                    </div>
                  </button>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                  <PeriodTag code={m.periodoCode} />
                  <span style={chip}>{CATEGORIES[m.categoriaCode]?.short ?? m.categoriaCode}</span>
                  <span style={chip}>{m.childCount} hijas · {m.bookCount} libros</span>
                  <span style={chip}>gate {m.gateScore}/5</span>
                  <span style={{ ...chip, opacity: 0.7 }}>{m.status}</span>
                  {m.tesisEnTension?.length > 0 && (
                    <span style={chip}>{m.tesisEnTension.length} tesis en tensión</span>
                  )}
                </div>

                {openId === m.id && <MasterDetail id={m.id} />}
              </li>
              </Fragment>
              );
            })}
          </ul>
        )}

        {!loading && totalPages > 1 && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 28 }}>
            <button style={ghostBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Anterior</button>
            <span style={{ color: "var(--fg-muted)", fontSize: 14 }}>{page} / {totalPages}</span>
            <button style={ghostBtn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente →</button>
          </div>
        )}
      </section>
    </div>
  );
}

const chip: React.CSSProperties = {
  fontSize: 12, color: "var(--fg-muted)", border: "1px solid var(--line)",
  borderRadius: 999, padding: "2px 10px", whiteSpace: "nowrap",
};

function MasterDetail({ id }: { id: string }) {
  const [data, setData] = useState<{
    master: Master; children: Child[]; deliverables: { id: string; status: string; templateId: string }[];
  } | null>(null);
  const [format, setFormat] = useState("ensayo-autor");
  const [producing, setProducing] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    fetch(`/api/preguntas-madre/${id}`).then((r) => r.json()).then((d) => { if (!c) setData(d); });
    return () => { c = true; };
  }, [id]);

  const produce = useCallback(async () => {
    setProducing("…");
    try {
      const r = await fetch(`/api/preguntas-madre/${id}/produce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formatId: format }),
      });
      const d = await r.json();
      setProducing(d.deliverableId ? "ok" : "error");
    } catch {
      setProducing("error");
    }
  }, [id, format]);

  if (!data) return <div style={{ color: "var(--fg-muted)", fontSize: 14, padding: "14px 0" }}>Cargando detalle…</div>;

  const tesis = (data.master.tesisEnTension ?? []).map((t) => (typeof t === "string" ? t : t.tesis ?? ""));

  return (
    <div style={{ marginTop: 16, paddingLeft: 16, borderLeft: "2px solid var(--line-strong)", display: "grid", gap: 18 }}>
      <div>
        <div className="label" style={{ marginBottom: 6 }}>Problema histórico</div>
        <p style={{ fontSize: 15, color: "var(--fg)", margin: 0 }}>{data.master.problemaSubyacente}</p>
      </div>

      {tesis.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Tesis en tensión</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            {tesis.map((t, i) => (
              <li key={i} style={{ fontSize: 14, color: "var(--fg-muted)" }}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="label" style={{ marginBottom: 6 }}>
          {data.children.length} preguntas-hija (proveniencia cross-libro)
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8, maxHeight: 320, overflow: "auto" }}>
          {data.children.map((ch) => (
            <li key={ch.id} style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.45 }}>
              · {ch.pregunta}
              {ch.libro && <span style={{ opacity: 0.6 }}> — {ch.libro.replace(/\.pdf$/i, "").slice(0, 48)}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="label">Producir con El Taller:</div>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          style={{ border: "1px solid var(--line-strong)", borderRadius: 6, padding: "6px 10px", background: "var(--bg)", color: "var(--fg)", fontSize: 14 }}
        >
          {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <button style={primaryBtn} onClick={produce} disabled={producing === "…"}>
          {producing === "…" ? "Enviando…" : "Producir"}
        </button>
        {producing === "ok" && (
          <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>
            Generando en background — míralo en <Link href="/producciones" style={{ textDecoration: "underline" }}>Producciones</Link>.
          </span>
        )}
        {producing === "error" && <span style={{ fontSize: 13, color: "var(--danger, #c0392b)" }}>Error al iniciar.</span>}
        {data.deliverables.length > 0 && (
          <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{data.deliverables.length} entregable(s) ya producido(s).</span>
        )}
      </div>
    </div>
  );
}
