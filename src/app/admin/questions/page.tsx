"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  FilterTabs,
  SearchInput,
  Pill,
  EmptyState,
  PeriodTag,
  StatusDot,
  primaryBtn,
  ghostBtn,
} from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import {
  TIPOS_PREGUNTA,
  ESCALAS_GEOGRAFICAS,
  TIPO_LABELS,
  ESCALA_LABELS,
  type TipoPregunta,
  type EscalaGeografica,
} from "@/lib/questions-config";
import {
  QuestionDetailDrawer,
  type QuestionDetail,
} from "@/components/questions/QuestionDetailDrawer";

type StateFilter = "all" | "pending" | "partial" | "complete";
type SortBy = "cronologico" | "periodo" | "categoria" | "subcategoria" | "recientes";
type ViewMode = "list" | "cards" | "table";

interface Question extends QuestionDetail {}

interface StatsData {
  totalQuestions: number;
  byState?: { pending: number; partial: number; complete: number; all: number };
  byCategoria?: Array<{ code: string; nombre: string; count: number }>;
  byPeriodo?: Array<{ code: string; nombre: string; count: number }>;
  byTipo?: Array<{ code: string; count: number }>;
  byEscala?: Array<{ code: string; count: number }>;
  topClusters?: Array<{ label: string; count: number }>;
}

function deriveState(q: Question): "pending" | "partial" | "complete" {
  const dlv = q.deliverables ?? [];
  if (dlv.length === 0) return "pending";
  if (dlv.some((d) => d.status === "COMPLETE")) {
    return dlv.length >= 3 ? "complete" : "partial";
  }
  return "partial";
}

const SORT_LABELS: Record<SortBy, string> = {
  cronologico: "Cronológico",
  periodo: "Por período",
  categoria: "Por categoría",
  subcategoria: "Por subcategoría",
  recientes: "Recientes",
};

export default function QuestionsPage() {
  return <QuestionsContent />;
}

function QuestionsContent() {
  const router = useRouter();
  // URL params: el initializer cubre la carga completa; la navegación cliente
  // (router.push desde /entities) se corrige en el efecto de sincronización
  // de abajo, porque window.location aún apunta a la URL anterior durante el
  // primer render. (useSearchParams+Suspense bloqueaba la hidratación aquí.)
  const [initialParams] = useState(() => {
    if (typeof window === "undefined")
      return { periodo: "", detail: "", entity: "", entityType: "" };
    const p = new URLSearchParams(window.location.search);
    return {
      periodo: p.get("periodo") ?? "",
      detail: p.get("detail") ?? "",
      entity: p.get("entity") ?? "",
      entityType: p.get("entityType") ?? "",
    };
  });
  const periodoParam = initialParams.periodo;
  const detailParam = initialParams.detail;

  // Filtros
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<string>(periodoParam);
  const [categoriaFilter, setCategoriaFilter] = useState<string>("");
  const [tipoFilter, setTipoFilter] = useState<TipoPregunta | "">("");
  const [escalaFilter, setEscalaFilter] = useState<EscalaGeografica | "">("");
  const [clusterFilter, setClusterFilter] = useState<string>("");
  // Filtro de entidad — llega desde la nube de /entities. entityType acota a
  // la lista correcta (persona/lugar/concepto) para que el total coincida
  // con el número mostrado en la nube.
  const [entityFilter, setEntityFilter] = useState<string>(initialParams.entity);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>(initialParams.entityType);
  const [search, setSearch] = useState("");
  // Orden + vista
  const [sortBy, setSortBy] = useState<SortBy>("cronologico");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Datos
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Total filtrado real (pagination.total) — se muestra en el chip de entidad
  // para que el número de la nube de /entities se confirme al aterrizar.
  const [filteredTotal, setFilteredTotal] = useState<number | null>(null);

  // Drawer
  const [selectedId, setSelectedId] = useState<string | null>(detailParam || null);
  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === selectedId) ?? null,
    [questions, selectedId]
  );

  // Re-lee la URL post-mount: en navegación cliente el initializer vio la URL
  // anterior. Los updaters funcionales evitan re-render si ya coincide (carga
  // completa). urlSynced ataja el fetch hasta tener los filtros correctos.
  const [urlSynced, setUrlSynced] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ent = p.get("entity") ?? "";
    const entType = p.get("entityType") ?? "";
    const per = p.get("periodo") ?? "";
    setEntityFilter((cur) => (cur === ent ? cur : ent));
    setEntityTypeFilter((cur) => (cur === entType ? cur : entType));
    setPeriodFilter((cur) => (cur === per ? cur : per));
    setUrlSynced(true);
  }, []);

  useEffect(() => {
    if (!urlSynced) return;
    let cancelled = false;
    setLoading(true);
    const p = new URLSearchParams({
      page: String(page),
      limit: viewMode === "table" ? "60" : "30",
      includeStats: "true",
      includeDeliverables: "true",
      sortBy,
    });
    if (periodFilter) p.set("periodo", periodFilter);
    if (categoriaFilter) p.set("categoria", categoriaFilter);
    if (tipoFilter) p.set("tipoPregunta", tipoFilter);
    if (escalaFilter) p.set("escalaGeografica", escalaFilter);
    if (clusterFilter) p.set("clusterTematico", clusterFilter);
    if (entityFilter) {
      p.set("entity", entityFilter);
      if (entityTypeFilter) p.set("entityType", entityTypeFilter);
    }
    if (search) p.set("search", search);
    if (stateFilter !== "all") p.set("state", stateFilter);

    (async () => {
      try {
        const r = await fetch(`/api/questions?${p}`);
        if (cancelled) return;
        const data = r.ok
          ? await r.json()
          : { questions: [], pagination: { totalPages: 1 } };
        if (cancelled) return;
        setQuestions(data.questions ?? []);
        setStats(data.stats ?? null);
        setTotalPages(data.pagination?.totalPages ?? 1);
        setFilteredTotal(data.pagination?.total ?? null);
      } catch {
        // ignored
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [urlSynced, page, periodFilter, categoriaFilter, tipoFilter, escalaFilter, clusterFilter, entityFilter, entityTypeFilter, search, stateFilter, sortBy, viewMode]);

  const counts = useMemo(() => {
    const total = stats?.totalQuestions ?? questions.length;
    return {
      all: total,
      pending: stats?.byState?.pending ?? 0,
      partial: stats?.byState?.partial ?? 0,
      complete: stats?.byState?.complete ?? 0,
    };
  }, [stats, questions]);

  const tipoOptions = useMemo(() => {
    // Mostramos solo los tipos con datos (filtrado por scope actual).
    const present = new Set((stats?.byTipo ?? []).map((t) => t.code));
    return (TIPOS_PREGUNTA as readonly string[])
      .filter((t) => present.has(t))
      .map((t) => ({
        code: t as TipoPregunta,
        count: (stats?.byTipo ?? []).find((x) => x.code === t)?.count ?? 0,
      }));
  }, [stats]);

  const escalaOptions = useMemo(() => {
    const present = new Set((stats?.byEscala ?? []).map((e) => e.code));
    return (ESCALAS_GEOGRAFICAS as readonly string[])
      .filter((e) => present.has(e))
      .map((e) => ({
        code: e as EscalaGeografica,
        count: (stats?.byEscala ?? []).find((x) => x.code === e)?.count ?? 0,
      }));
  }, [stats]);

  const activeFiltersCount =
    (periodFilter ? 1 : 0) +
    (categoriaFilter ? 1 : 0) +
    (tipoFilter ? 1 : 0) +
    (escalaFilter ? 1 : 0) +
    (clusterFilter ? 1 : 0);

  const clearAllAdvanced = () => {
    setCategoriaFilter("");
    setTipoFilter("");
    setEscalaFilter("");
    setClusterFilter("");
    setPage(1);
  };

  return (
    <div className="fade-up" data-screen-label="Questions">
      <PageHeader
        label={`Investigación · ${counts.all} preguntas curadas`}
        title="Preguntas"
        italic="del corpus"
        subtitle="Cada documento genera 6–32 preguntas guiadas. Cada pregunta puede materializarse en una o más producciones (ensayo, paper, análisis comparado…)."
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              style={ghostBtn}
              onClick={() => router.push("/admin/questions/matriz")}
            >
              Vista matriz
            </button>
            <button
              type="button"
              style={primaryBtn}
              onClick={() => router.push("/admin/questions/generate")}
            >
              Generar →
            </button>
          </div>
        }
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      {/* Controles primarios: estado tabs + búsqueda + sort + view */}
      <section style={{ padding: "20px 56px 8px", maxWidth: 1320 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <FilterTabs<StateFilter>
            value={stateFilter}
            onChange={(v) => {
              setStateFilter(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: `Todas · ${counts.all}` },
              { value: "complete", label: `Completas · ${counts.complete}` },
              { value: "partial", label: `Parciales · ${counts.partial}` },
              { value: "pending", label: `Pendientes · ${counts.pending}` },
            ]}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar preguntas…" />
            <SortMenu value={sortBy} onChange={(v) => { setSortBy(v); setPage(1); }} />
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Períodos (siempre visibles, son el filtro estructural primario) */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 18, alignItems: "center" }}>
          {entityFilter && (
            <Pill
              active
              onClick={() => {
                setEntityFilter("");
                setEntityTypeFilter("");
                setPage(1);
              }}
            >
              Entidad: {entityFilter}
              {filteredTotal != null ? ` · ${filteredTotal}` : ""} ✕
            </Pill>
          )}
          <Pill active={periodFilter === ""} onClick={() => setPeriodFilter("")}>
            Todos los períodos
          </Pill>
          {(Object.keys(PERIODS) as PeriodCode[])
            .filter((c) => c !== "TRANS")
            .map((code) => (
              <Pill
                key={code}
                active={periodFilter === code}
                onClick={() => {
                  setPeriodFilter(code);
                  setPage(1);
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: `var(--p-${PERIODS[code].slug})`,
                  }}
                />
                {code}
              </Pill>
            ))}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="mono"
            style={{
              appearance: "none",
              background: "transparent",
              border: "1px solid var(--line-strong)",
              borderRadius: 999,
              padding: "5px 12px",
              fontSize: 11.5,
              color: "var(--fg-muted)",
              cursor: "pointer",
              letterSpacing: "0.02em",
            }}
          >
            {showAdvanced ? "− Filtros avanzados" : "+ Filtros avanzados"}
            {activeFiltersCount > 0 && !showAdvanced ? ` · ${activeFiltersCount}` : ""}
          </button>
          {activeFiltersCount > 0 && showAdvanced && (
            <button
              type="button"
              onClick={clearAllAdvanced}
              className="mono"
              style={{
                appearance: "none",
                background: "transparent",
                border: 0,
                fontSize: 11,
                color: "var(--fg-faint)",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              limpiar
            </button>
          )}
        </div>

        {/* Filtros avanzados */}
        {showAdvanced && (
          <div
            style={{
              marginTop: 16,
              padding: "16px 0",
              borderTop: "1px solid var(--line)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {/* Categorías */}
            <FilterRow label="Categoría">
              <Pill
                active={categoriaFilter === ""}
                onClick={() => { setCategoriaFilter(""); setPage(1); }}
              >
                Todas
              </Pill>
              {(stats?.byCategoria ?? []).slice(0, 11).map((c) => (
                <Pill
                  key={c.code}
                  active={categoriaFilter === c.code}
                  onClick={() => { setCategoriaFilter(c.code); setPage(1); }}
                >
                  {c.code} · {c.count}
                </Pill>
              ))}
            </FilterRow>

            {/* Tipo analítico (nuevo) */}
            {tipoOptions.length > 0 && (
              <FilterRow label="Tipo analítico">
                <Pill active={tipoFilter === ""} onClick={() => { setTipoFilter(""); setPage(1); }}>
                  Todos
                </Pill>
                {tipoOptions.map((t) => (
                  <Pill
                    key={t.code}
                    active={tipoFilter === t.code}
                    onClick={() => { setTipoFilter(t.code); setPage(1); }}
                  >
                    {TIPO_LABELS[t.code]} · {t.count}
                  </Pill>
                ))}
              </FilterRow>
            )}

            {/* Escala (nueva) */}
            {escalaOptions.length > 0 && (
              <FilterRow label="Escala geográfica">
                <Pill active={escalaFilter === ""} onClick={() => { setEscalaFilter(""); setPage(1); }}>
                  Todas
                </Pill>
                {escalaOptions.map((e) => (
                  <Pill
                    key={e.code}
                    active={escalaFilter === e.code}
                    onClick={() => { setEscalaFilter(e.code); setPage(1); }}
                  >
                    {ESCALA_LABELS[e.code]} · {e.count}
                  </Pill>
                ))}
              </FilterRow>
            )}

            {/* Clusters temáticos (nuevo) */}
            {(stats?.topClusters ?? []).length > 0 && (
              <FilterRow label="Cluster temático">
                <Pill active={clusterFilter === ""} onClick={() => { setClusterFilter(""); setPage(1); }}>
                  Todos
                </Pill>
                {(stats!.topClusters ?? []).map((c) => (
                  <Pill
                    key={c.label}
                    active={clusterFilter === c.label}
                    onClick={() => { setClusterFilter(c.label); setPage(1); }}
                  >
                    {c.label} · {c.count}
                  </Pill>
                ))}
              </FilterRow>
            )}
          </div>
        )}
      </section>

      {/* Cuerpo: 3 modos de vista */}
      <section style={{ padding: "8px 56px 96px", maxWidth: 1320 }}>
        {loading && <LoadingSkeleton mode={viewMode} />}

        {!loading && questions.length > 0 && viewMode === "list" && (
          <ListView questions={questions} onSelect={setSelectedId} />
        )}
        {!loading && questions.length > 0 && viewMode === "cards" && (
          <CardsView questions={questions} onSelect={setSelectedId} />
        )}
        {!loading && questions.length > 0 && viewMode === "table" && (
          <TableView questions={questions} onSelect={setSelectedId} />
        )}

        {!loading && questions.length === 0 && (
          <EmptyState
            title="Sin resultados"
            hint="Ajusta los filtros o genera preguntas para un documento."
            action={
              <button
                type="button"
                style={primaryBtn}
                onClick={() => router.push("/admin/questions/generate")}
              >
                Generar preguntas →
              </button>
            }
          />
        )}

        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        )}
      </section>

      <QuestionDetailDrawer
        question={selectedQuestion}
        onClose={() => setSelectedId(null)}
        onSelectCluster={(c) => { setClusterFilter(c); setSelectedId(null); setPage(1); }}
      />
    </div>
  );
}

/* ─── Sub-componentes ─────────────────────────────────────────────────── */

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
      <div
        className="mono"
        style={{
          fontSize: 10.5,
          color: "var(--fg-faint)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          paddingTop: 6,
          minWidth: 130,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function SortMenu({ value, onChange }: { value: SortBy; onChange: (v: SortBy) => void }) {
  return (
    <label
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11,
        color: "var(--fg-muted)",
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ textTransform: "uppercase" }}>Orden</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortBy)}
        style={{
          appearance: "none",
          background: "transparent",
          border: "1px solid var(--line-strong)",
          padding: "5px 28px 5px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--fg)",
          letterSpacing: "0.02em",
          cursor: "pointer",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' fill='none' stroke='currentColor' stroke-width='1.4'><path d='M1 1.5 L5 4.5 L9 1.5'/></svg>\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          backgroundSize: "8px",
        }}
      >
        {(Object.keys(SORT_LABELS) as SortBy[]).map((k) => (
          <option key={k} value={k}>
            {SORT_LABELS[k]}
          </option>
        ))}
      </select>
    </label>
  );
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: Array<{ v: ViewMode; label: string; icon: React.ReactNode }> = [
    { v: "list", label: "Lista", icon: <ListIcon /> },
    { v: "cards", label: "Cards", icon: <CardsIcon /> },
    { v: "table", label: "Tabla", icon: <TableIcon /> },
  ];
  return (
    <div
      style={{
        display: "inline-flex",
        border: "1px solid var(--line-strong)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {opts.map((o, i) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          title={o.label}
          aria-label={o.label}
          aria-pressed={value === o.v}
          style={{
            appearance: "none",
            background: value === o.v ? "var(--fg)" : "transparent",
            color: value === o.v ? "var(--bg)" : "var(--fg-muted)",
            border: 0,
            borderLeft: i === 0 ? 0 : "1px solid var(--line-strong)",
            padding: "6px 10px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 140ms var(--ease-out-custom)",
          }}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
      <line x1="3" y1="4" x2="11" y2="4" />
      <line x1="3" y1="7" x2="11" y2="7" />
      <line x1="3" y1="10" x2="11" y2="10" />
    </svg>
  );
}
function CardsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="2" y="2" width="4.5" height="4.5" />
      <rect x="7.5" y="2" width="4.5" height="4.5" />
      <rect x="2" y="7.5" width="4.5" height="4.5" />
      <rect x="7.5" y="7.5" width="4.5" height="4.5" />
    </svg>
  );
}
function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="2" y="3" width="10" height="8" />
      <line x1="2" y1="6" x2="12" y2="6" />
      <line x1="2" y1="9" x2="12" y2="9" />
      <line x1="6" y1="3" x2="6" y2="11" />
    </svg>
  );
}

function LoadingSkeleton({ mode }: { mode: ViewMode }) {
  if (mode === "cards") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ padding: 18, border: "1px solid var(--line)" }}>
            <div className="shimmer-line" style={{ height: 16, width: "85%", marginBottom: 10 }} />
            <div className="shimmer-line" style={{ height: 12, width: "60%" }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} style={{ padding: "22px 0", borderBottom: "1px solid var(--line)" }}>
          <div className="shimmer-line" style={{ height: 22, width: "70%", marginBottom: 8 }} />
          <div className="shimmer-line" style={{ height: 12, width: "40%" }} />
        </li>
      ))}
    </ul>
  );
}

/* ─── ListView (mantiene el look v2) ───────────────────────────────────── */

function ListView({ questions, onSelect }: { questions: Question[]; onSelect: (id: string) => void }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {questions.map((q, i) => (
        <ListRow key={q.id} q={q} i={i} onClick={() => onSelect(q.id)} />
      ))}
    </ul>
  );
}

function ListRow({ q, i, onClick }: { q: Question; i: number; onClick: () => void }) {
  const state = deriveState(q);
  const completed = (q.deliverables ?? []).filter((d) => d.status === "COMPLETE").length;
  const entities = [
    ...(q.entidadesPersonas ?? []),
    ...(q.entidadesLugares ?? []),
    ...(q.entidadesConceptos ?? []),
  ];
  const tipoLabel = q.tipoPregunta ? TIPO_LABELS[q.tipoPregunta as TipoPregunta] ?? q.tipoPregunta : null;
  return (
    <li
      style={{
        borderTop: i === 0 ? "1px solid var(--line-strong)" : 0,
        borderBottom: "1px solid var(--line)",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          appearance: "none",
          background: "transparent",
          border: 0,
          padding: "22px 0",
          cursor: "pointer",
          textAlign: "left",
          display: "grid",
          gridTemplateColumns: "60px 1fr 180px 140px",
          gap: 24,
          alignItems: "baseline",
          transition: "background 120ms var(--ease-out-custom)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div className="mono num" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
          #{String(q.questionNumber).padStart(3, "0")}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            className="serif"
            style={{ fontSize: 19, color: "var(--fg)", lineHeight: 1.3, letterSpacing: "-0.005em" }}
          >
            {q.pregunta}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--fg-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {q.periodoNombre} · {q.categoriaCode}
            </span>
            {tipoLabel && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--fg)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "1px 6px",
                  border: "1px solid var(--fg)",
                  borderRadius: 3,
                }}
              >
                {tipoLabel}
              </span>
            )}
            {q.clusterTematico && (
              <span style={{ fontSize: 11.5, color: "var(--fg-muted)", fontStyle: "italic" }}>
                {q.clusterTematico}
              </span>
            )}
            {entities.slice(0, 2).map((e) => (
              <span key={e} style={{ fontSize: 11.5, color: "var(--fg-muted)" }}>
                {e}
              </span>
            ))}
          </div>
        </div>
        <PeriodTag code={q.periodoCode} size="sm" />
        <QState state={state} completed={completed} />
      </button>
    </li>
  );
}

/* ─── CardsView ────────────────────────────────────────────────────────── */

function CardsView({ questions, onSelect }: { questions: Question[]; onSelect: (id: string) => void }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 16,
      }}
    >
      {questions.map((q) => (
        <QuestionCard key={q.id} q={q} onClick={() => onSelect(q.id)} />
      ))}
    </div>
  );
}

function QuestionCard({ q, onClick }: { q: Question; onClick: () => void }) {
  const state = deriveState(q);
  const completed = (q.deliverables ?? []).filter((d) => d.status === "COMPLETE").length;
  const tipoLabel = q.tipoPregunta ? TIPO_LABELS[q.tipoPregunta as TipoPregunta] ?? q.tipoPregunta : null;
  const entities = [
    ...(q.entidadesPersonas ?? []),
    ...(q.entidadesLugares ?? []),
    ...(q.entidadesConceptos ?? []),
  ].slice(0, 4);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none",
        background: "transparent",
        border: "1px solid var(--line)",
        padding: "18px 20px",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transition: "border-color 140ms var(--ease-out-custom), background 140ms var(--ease-out-custom)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--fg)";
        e.currentTarget.style.background = "var(--bg-muted)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--line)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span className="mono num" style={{ fontSize: 10.5, color: "var(--fg-faint)", letterSpacing: "0.04em" }}>
          #{String(q.questionNumber).padStart(3, "0")}
        </span>
        <PeriodTag code={q.periodoCode} size="sm" />
      </div>
      <p
        className="serif"
        style={{
          margin: 0,
          fontSize: 15.5,
          lineHeight: 1.35,
          color: "var(--fg)",
          letterSpacing: "-0.003em",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 4,
          overflow: "hidden",
        }}
      >
        {q.pregunta}
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {tipoLabel && (
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              padding: "2px 7px",
              background: "var(--fg)",
              color: "var(--bg)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              borderRadius: 3,
            }}
          >
            {tipoLabel}
          </span>
        )}
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--fg-muted)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {q.categoriaCode}
        </span>
      </div>
      {q.clusterTematico && (
        <div
          style={{
            fontSize: 12,
            color: "var(--fg-muted)",
            fontStyle: "italic",
            borderTop: "1px solid var(--line)",
            paddingTop: 10,
          }}
        >
          {q.clusterTematico}
        </div>
      )}
      {entities.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {entities.map((e) => (
            <span
              key={e}
              style={{
                fontSize: 10.5,
                color: "var(--fg-muted)",
                padding: "2px 7px",
                background: "var(--bg-muted)",
                borderRadius: 3,
              }}
            >
              {e}
            </span>
          ))}
        </div>
      )}
      <div style={{ marginTop: "auto", paddingTop: 6 }}>
        <QState state={state} completed={completed} />
      </div>
    </button>
  );
}

/* ─── TableView (densa, para escaneo bulk) ─────────────────────────────── */

function TableView({ questions, onSelect }: { questions: Question[]; onSelect: (id: string) => void }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--line-strong)" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12.5,
          color: "var(--fg)",
        }}
      >
        <thead>
          <tr style={{ background: "var(--bg-muted)" }}>
            <Th width={50}>#</Th>
            <Th>Pregunta</Th>
            <Th width={130}>Período</Th>
            <Th width={80}>Cat.</Th>
            <Th width={170}>Tipo</Th>
            <Th width={110}>Escala</Th>
            <Th width={70}>Año</Th>
            <Th width={100}>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q, i) => {
            const tipoLabel = q.tipoPregunta ? TIPO_LABELS[q.tipoPregunta as TipoPregunta] ?? q.tipoPregunta : "—";
            const escalaLabel = q.escalaGeografica
              ? ESCALA_LABELS[q.escalaGeografica as EscalaGeografica] ?? q.escalaGeografica
              : "—";
            const state = deriveState(q);
            const completed = (q.deliverables ?? []).filter((d) => d.status === "COMPLETE").length;
            return (
              <tr
                key={q.id}
                onClick={() => onSelect(q.id)}
                style={{
                  borderTop: i === 0 ? 0 : "1px solid var(--line)",
                  cursor: "pointer",
                  transition: "background 100ms var(--ease-out-custom)",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-muted)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
              >
                <Td mono faint>{String(q.questionNumber).padStart(3, "0")}</Td>
                <Td>
                  <div style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                    lineHeight: 1.35,
                  }}>
                    {q.pregunta}
                  </div>
                </Td>
                <Td><PeriodTag code={q.periodoCode} size="sm" /></Td>
                <Td mono>{q.categoriaCode}</Td>
                <Td mono small>{tipoLabel}</Td>
                <Td mono small>{escalaLabel}</Td>
                <Td mono faint>{q.yearPrincipal ?? "—"}</Td>
                <Td><QState state={state} completed={completed} /></Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, width }: { children: React.ReactNode; width?: number }) {
  return (
    <th
      className="mono"
      style={{
        textAlign: "left",
        padding: "9px 12px",
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--fg-faint)",
        borderBottom: "1px solid var(--line-strong)",
        width,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  mono,
  small,
  faint,
}: {
  children: React.ReactNode;
  mono?: boolean;
  small?: boolean;
  faint?: boolean;
}) {
  return (
    <td
      className={mono ? "mono" : undefined}
      style={{
        padding: "10px 12px",
        verticalAlign: "middle",
        fontSize: small ? 11 : mono ? 11.5 : 12.5,
        color: faint ? "var(--fg-faint)" : "var(--fg)",
        letterSpacing: mono ? "0.02em" : undefined,
      }}
    >
      {children}
    </td>
  );
}

function QState({ state, completed }: { state: "pending" | "partial" | "complete"; completed: number }) {
  if (state === "complete") {
    return <StatusDot kind="success" label={`${completed} producciones`} />;
  }
  if (state === "partial") {
    return <StatusDot kind="warning" label={`${completed} parcial`} />;
  }
  return <StatusDot kind="muted" label="Pendiente" />;
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (n: number) => void;
}) {
  return (
    <div
      style={{
        marginTop: 32,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--fg-muted)",
      }}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        style={{
          appearance: "none",
          background: "transparent",
          border: "1px solid var(--line-strong)",
          padding: "4px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--fg-muted)",
          cursor: page <= 1 ? "default" : "pointer",
          opacity: page <= 1 ? 0.4 : 1,
        }}
      >
        ←
      </button>
      <span>{page} / {totalPages}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        style={{
          appearance: "none",
          background: "transparent",
          border: "1px solid var(--line-strong)",
          padding: "4px 10px",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--fg-muted)",
          cursor: page >= totalPages ? "default" : "pointer",
          opacity: page >= totalPages ? 0.4 : 1,
        }}
      >
        →
      </button>
    </div>
  );
}
