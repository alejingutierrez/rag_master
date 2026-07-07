"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader, FilterTabs, SearchInput, primaryBtn, ghostBtn } from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import type { LongitudId } from "@/lib/atelier-formats";
import {
  ENTITY_SERIES_TABS,
  SERIES_DEFAULT_LONGITUD,
  SERIES_HIDE_PRODUCED_DEFAULT,
  SERIES_REQUIRE_IMAGE,
  buildSeriesCatalogPageUrl,
  buildSeriesEntityCatalogUrl,
  evaluateSeriesPoll,
  shouldFetchSeriesCatalogPage,
  type SeriesEntityType,
} from "@/lib/atelier/series";
import {
  fichaFormatForKind,
  kindLabel,
  hechoKey,
  entidadKey,
  epocaKey,
  type SourceKind,
} from "@/lib/source-ref";
import { fmtYearSpan } from "@/components/timeline/TimelineEventDrawer";

// ─────────────────────────────────────────────────────────────────────────────
// Producción en serie — selecciona muchos ítems de una tipología y prodúcelos
// como su ficha (la que los marca como producidos), en segundo plano y con
// concurrencia acotada en el cliente. Reusa el mismo motor (/api/atelier y, para
// preguntas-madre, su endpoint dedicado). Mantén esta pestaña abierta: el pool
// que rellena los cupos vive en el cliente (cada pieza corre server-side).
// ─────────────────────────────────────────────────────────────────────────────

type RunStatus = "idle" | "queued" | "running" | "imaging" | "done" | "error";

interface SerieItem {
  key: string;
  label: string;
  intent: string;
  sublabel?: string;
}

interface ProducedInfo {
  deliverableId: string;
  publishedAt: string | null;
}

const KINDS: { kind: SourceKind; label: string }[] = [
  { kind: "pregunta", label: "Preguntas" },
  { kind: "pregunta-madre", label: "Preguntas madre" },
  { kind: "hecho", label: "Hechos" },
  { kind: "entidad", label: "Entidades" },
  { kind: "epoca", label: "Épocas" },
];

const LONGITUDES: { value: LongitudId; label: string }[] = [
  { value: "compacta", label: "Compacta" },
  { value: "normal", label: "Normal" },
  { value: "extensa", label: "Extensa" },
];

/** Concatena todas las páginas que declare un endpoint paginado. */
async function fetchPaged<T>(base: string, key: string, signal: AbortSignal): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const r = await fetch(buildSeriesCatalogPageUrl(base, page), { signal });
    if (!r.ok) break;
    const d = await r.json();
    out.push(...((d[key] as T[]) ?? []));
    totalPages = d.pagination?.totalPages ?? 1;
    page++;
  } while (shouldFetchSeriesCatalogPage(page, totalPages));
  return out;
}

async function loadCatalog(
  kind: SourceKind,
  signal: AbortSignal,
  entityType: SeriesEntityType,
): Promise<SerieItem[]> {
  switch (kind) {
    case "pregunta": {
      const rows = await fetchPaged<{ id: string; pregunta: string; periodoNombre?: string; periodoCode?: string }>(
        "/api/questions",
        "questions",
        signal,
      );
      return rows.map((q) => ({
        key: q.id,
        label: q.pregunta,
        intent: q.pregunta,
        sublabel: q.periodoNombre ?? q.periodoCode,
      }));
    }
    case "pregunta-madre": {
      const rows = await fetchPaged<{ id: string; pregunta: string; periodoCode?: string }>(
        "/api/preguntas-madre",
        "items",
        signal,
      );
      return rows.map((m) => ({ key: m.id, label: m.pregunta, intent: m.pregunta, sublabel: m.periodoCode }));
    }
    case "hecho": {
      const r = await fetch("/api/timeline/events", { signal });
      if (!r.ok) return [];
      const d = await r.json();
      const periods: Record<string, { events?: Array<{ id: string; titulo: string; porQueImporta: string; anioInicio: number; anioFin: number }> }> =
        d.periods ?? {};
      const out: SerieItem[] = [];
      for (const code of Object.keys(periods)) {
        for (const e of periods[code].events ?? []) {
          out.push({
            key: hechoKey(code, e),
            label: e.titulo,
            intent: `${e.titulo} (${fmtYearSpan(e.anioInicio, e.anioFin)}): ${e.porQueImporta}`,
            sublabel: code,
          });
        }
      }
      return out;
    }
    case "entidad": {
      const r = await fetch(buildSeriesEntityCatalogUrl(entityType), { signal });
      if (!r.ok) return [];
      const d = await r.json();
      const ents: Array<{ name: string; type: string; mentions: number }> = d.entities ?? [];
      return ents.map((e) => ({
        key: entidadKey(e.type, e.name),
        label: e.name,
        intent: e.name,
        sublabel: `${e.type} · ${e.mentions}`,
      }));
    }
    case "epoca": {
      return (Object.keys(PERIODS) as PeriodCode[]).map((code) => ({
        key: epocaKey(code),
        label: PERIODS[code].label,
        intent: `${PERIODS[code].label} (${PERIODS[code].yearRange})`,
        sublabel: PERIODS[code].yearRange,
      }));
    }
  }
}

export default function SeriePage() {
  const [kind, setKind] = useState<SourceKind>("hecho");
  const [entityType, setEntityType] = useState<SeriesEntityType>("person");
  const [items, setItems] = useState<SerieItem[]>([]);
  const [produced, setProduced] = useState<Record<string, ProducedInfo>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hideProduced, setHideProduced] = useState(SERIES_HIDE_PRODUCED_DEFAULT);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [concurrency, setConcurrency] = useState(3);
  const [longitud, setLongitud] = useState<LongitudId>(SERIES_DEFAULT_LONGITUD);
  const [requireImage, setRequireImage] = useState(SERIES_REQUIRE_IMAGE);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<Record<string, RunStatus>>({});
  const cancelRef = useRef(false);

  // Carga catálogo + estado de producción al cambiar de tipología.
  const loadProduced = useCallback(async (k: SourceKind, signal?: AbortSignal) => {
    const r = await fetch(`/api/production-state?kind=${k}`, { signal }).catch(() => null);
    if (!r || !r.ok) return;
    const d = await r.json();
    setProduced(d.produced ?? {});
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setSelected(new Set());
    setStatus({});
    Promise.all([
      loadCatalog(kind, ctrl.signal, entityType).then((rows) => setItems(rows)),
      loadProduced(kind, ctrl.signal),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [kind, entityType, loadProduced]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (hideProduced && produced[it.key]) return false;
      if (q && !it.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, hideProduced, produced]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const it of visible) next.add(it.key);
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  // Dispara una producción y espera (poll) a que termine, liberando el cupo.
  const produceOne = useCallback(
    async (item: SerieItem): Promise<void> => {
      setStatus((s) => ({ ...s, [item.key]: "running" }));
      try {
        let deliverableId: string | undefined;
        if (kind === "pregunta-madre") {
          const r = await fetch(`/api/preguntas-madre/${item.key}/produce`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ formatId: "ficha-pregunta", longitud }),
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          deliverableId = (await r.json()).deliverableId;
        } else {
          const r = await fetch("/api/atelier", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              intent: item.intent,
              formatId: fichaFormatForKind(kind),
              longitud,
              sourceRef: { kind, key: item.key, label: item.label },
              questionId: kind === "pregunta" ? item.key : undefined,
            }),
          });
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error((err as { error?: string }).error ?? `HTTP ${r.status}`);
          }
          deliverableId = (await r.json()).deliverableId;
        }
        if (!deliverableId) throw new Error("sin deliverableId");

        let imageKickoffStarted = false;
        let imageRetries = 0;

        // Poll hasta COMPLETE/ERROR; si la serie exige portada, espera también
        // metadata.image ok o imageUrl/imageKey persistidos.
        for (;;) {
          if (cancelRef.current) return; // se cortó: deja de esperar (la pieza sigue server-side)
          await new Promise((res) => setTimeout(res, 5000));
          const pr = await fetch(`/api/deliverables/${deliverableId}`).catch(() => null);
          if (!pr || !pr.ok) continue;
          const d = await pr.json();
          const action = evaluateSeriesPoll(d, {
            requireImage,
            imageRetries,
            imageKickoffStarted,
          });
          if (action.kind === "done") {
            setStatus((s) => ({ ...s, [item.key]: "done" }));
            return;
          }
          if (action.kind === "error") {
            setStatus((s) => ({ ...s, [item.key]: "error" }));
            return;
          }
          if (action.kind === "trigger-image") {
            setStatus((s) => ({ ...s, [item.key]: "imaging" }));
            if (!imageKickoffStarted || action.reason === "image-error") {
              const ir = await fetch(`/api/deliverables/${deliverableId}/generate-image`, {
                method: "POST",
              }).catch(() => null);
              if (!ir || (!ir.ok && ir.status !== 409)) {
                const err = await ir?.json().catch(() => ({}));
                throw new Error((err as { error?: string }).error ?? "No se pudo iniciar la imagen");
              }
              imageKickoffStarted = true;
              if (action.reason === "image-error") imageRetries++;
            }
          } else if (action.reason === "image-running" || action.reason === "image-kickoff-running") {
            setStatus((s) => ({ ...s, [item.key]: "imaging" }));
          }
        }
      } catch (e) {
        setStatus((s) => ({ ...s, [item.key]: "error" }));
        console.warn(`[serie] ${item.key}:`, (e as Error).message);
      }
    },
    [kind, longitud, requireImage],
  );

  const start = useCallback(async () => {
    const queue = items.filter((it) => selected.has(it.key));
    if (queue.length === 0) {
      toast.warning("Selecciona al menos un ítem.");
      return;
    }
    cancelRef.current = false;
    setRunning(true);
    setStatus(Object.fromEntries(queue.map((it) => [it.key, "queued" as RunStatus])));
    toast.success(
      `Produciendo ${queue.length} ${kindLabel(kind)}(s) en serie · ${longitud} · concurrencia ${concurrency}${
        requireImage ? " · con portada" : ""
      }`,
    );

    // Pool acotado: mantiene `concurrency` producciones en vuelo, rellenando al terminar.
    let idx = 0;
    const worker = async () => {
      while (!cancelRef.current && idx < queue.length) {
        const item = queue[idx++];
        await produceOne(item);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

    setRunning(false);
    await loadProduced(kind);
    if (!cancelRef.current) toast.success("Serie terminada.");
  }, [items, selected, concurrency, kind, longitud, requireImage, produceOne, loadProduced]);

  const stop = () => {
    cancelRef.current = true;
    setRunning(false);
    toast.info("Serie detenida. Las piezas en vuelo terminan en segundo plano.");
  };

  const stats = useMemo(() => {
    const vals = Object.values(status);
    return {
      queued: vals.filter((v) => v === "queued").length,
      running: vals.filter((v) => v === "running").length,
      imaging: vals.filter((v) => v === "imaging").length,
      done: vals.filter((v) => v === "done").length,
      error: vals.filter((v) => v === "error").length,
    };
  }, [status]);

  const currentEntityTab = ENTITY_SERIES_TABS.find((tab) => tab.type === entityType) ?? ENTITY_SERIES_TABS[0];
  const catalogLabel = kind === "entidad" ? currentEntityTab.label.toLowerCase() : `${kindLabel(kind)}s`;

  return (
    <div className="fade-up" data-screen-label="AtelierSerie">
      <PageHeader
        label="Producción · En serie"
        title="Producción en serie"
        subtitle="Selecciona muchos ítems de una tipología y prodúcelos como su ficha (la que los marca como producidos), en segundo plano y con concurrencia. Mantén esta pestaña abierta mientras corre."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section style={{ padding: "20px 56px 0", maxWidth: 1100 }}>
        <FilterTabs<SourceKind>
          value={kind}
          onChange={(k) => !running && setKind(k)}
          options={KINDS.map((x) => ({ value: x.kind, label: x.label }))}
        />
      </section>

      {kind === "entidad" && (
        <section style={{ padding: "14px 56px 0", maxWidth: 1100 }}>
          <FilterTabs<SeriesEntityType>
            value={entityType}
            onChange={(t) => !running && setEntityType(t)}
            options={ENTITY_SERIES_TABS.map((x) => ({ value: x.type, label: x.label }))}
          />
        </section>
      )}

      {/* Barra de control */}
      <section
        style={{
          padding: "20px 56px",
          maxWidth: 1100,
          display: "flex",
          gap: 18,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <SearchInput value={search} onChange={setSearch} placeholder={`Filtrar ${catalogLabel}…`} />
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--fg-muted)" }}>
          <input type="checkbox" checked={hideProduced} onChange={(e) => setHideProduced(e.target.checked)} />
          Ocultar ya producidos
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>Concurrencia</span>
          <input
            type="range"
            min={1}
            max={6}
            value={concurrency}
            disabled={running}
            onChange={(e) => setConcurrency(Number(e.target.value))}
          />
          <span className="mono" style={{ fontSize: 12, color: "var(--fg)", width: 14 }}>
            {concurrency}
          </span>
        </div>
        <FilterTabs<LongitudId>
          value={longitud}
          onChange={(v) => !running && setLongitud(v)}
          options={LONGITUDES}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--fg-muted)" }}>
          <input
            type="checkbox"
            checked={requireImage}
            disabled={running}
            onChange={(e) => setRequireImage(e.target.checked)}
          />
          Esperar portada
        </label>
        <button type="button" onClick={selectAllVisible} style={{ ...ghostBtn, fontSize: 12 }}>
          Todos (visibles)
        </button>
        <button type="button" onClick={clearSelection} style={{ ...ghostBtn, fontSize: 12 }}>
          Ninguno
        </button>
        <div style={{ flex: 1 }} />
        {!running ? (
          <button
            type="button"
            onClick={start}
            disabled={selected.size === 0}
            style={selected.size === 0 ? { ...primaryBtn, opacity: 0.4, cursor: "default" } : primaryBtn}
          >
            Producir {selected.size} como {kindLabel(kind)} →
          </button>
        ) : (
          <button type="button" onClick={stop} style={{ ...primaryBtn, background: "var(--danger)", borderColor: "var(--danger)" }}>
            Detener
          </button>
        )}
      </section>

      {/* Resumen de progreso */}
      {(running || stats.done > 0 || stats.error > 0) && (
        <section style={{ padding: "0 56px 8px", maxWidth: 1100 }}>
          <div className="mono" style={{ fontSize: 12, color: "var(--fg-muted)", display: "flex", gap: 18, flexWrap: "wrap" }}>
            <span>◐ en curso: {stats.running}</span>
            <span>▧ portada: {stats.imaging}</span>
            <span>· en cola: {stats.queued}</span>
            <span style={{ color: "var(--success)" }}>✓ listas: {stats.done}</span>
            {stats.error > 0 && <span style={{ color: "var(--danger)" }}>✕ error: {stats.error}</span>}
          </div>
        </section>
      )}

      <section style={{ padding: "12px 56px 96px", maxWidth: 1100 }}>
        <div style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 12 }}>
          {loading
            ? "Cargando catálogo…"
            : `${visible.length} ${kindLabel(kind)}s · ${selected.size} seleccionadas`}
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {visible.map((it) => {
            const st = status[it.key] ?? "idle";
            const prod = produced[it.key];
            const checked = selected.has(it.key);
            return (
              <li
                key={it.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={running}
                  onChange={() => toggle(it.key)}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--fg)",
                      lineHeight: 1.35,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {it.label}
                  </div>
                  {it.sublabel && (
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-faint)", marginTop: 2 }}>
                      {it.sublabel}
                    </div>
                  )}
                </div>
                <RunGlyph status={st} produced={!!prod} />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function RunGlyph({ status, produced }: { status: RunStatus; produced: boolean }) {
  if (status === "running") return <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>◐ produciendo…</span>;
  if (status === "imaging") return <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>▧ portada…</span>;
  if (status === "queued") return <span className="mono" style={{ fontSize: 12, color: "var(--fg-faint)" }}>· en cola</span>;
  if (status === "done") return <span className="mono" style={{ fontSize: 12, color: "var(--success)" }}>✓ listo</span>;
  if (status === "error") return <span className="mono" style={{ fontSize: 12, color: "var(--danger)" }}>✕ error</span>;
  if (produced) return <span className="mono" style={{ fontSize: 12, color: "var(--success)" }}>✓ producido</span>;
  return <span className="mono" style={{ fontSize: 11, color: "var(--fg-faint)" }}>—</span>;
}
