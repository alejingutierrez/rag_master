"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Zap,
  RotateCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Table as TableIcon,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
} from "@/components/ui";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryChip } from "@/components/domain/category-chip";
import { cn } from "@/lib/cn";

type CellStatus = "PENDING" | "GENERATING" | "COMPLETE" | "ERROR" | null;

interface Template {
  id: string;
  name: string;
  category: string;
  icon: string;
}

interface MatrixRow {
  id: string;
  pregunta: string;
  periodoCode: string;
  periodoNombre: string;
  categoriaCode: string;
  categoriaNombre: string;
  subcategoriaCode: string;
  documentId: string;
  documentFilename: string;
  completedCount: number;
  stateLabel: "complete" | "partial" | "pending";
  byTemplate: Record<
    string,
    { deliverableId: string; status: CellStatus } | null
  >;
}

interface MatrixResponse {
  templates: Template[];
  totalTemplates: number;
  rows: MatrixRow[];
  counts: { all: number; complete: number; partial: number; pending: number };
}

export default function MatrixPage() {
  return (
    <Suspense
      fallback={
        <div className="app-page-wide">
          <Skeleton variant="line" className="h-8 w-64 mb-4" />
          <Skeleton variant="line" className="h-4 w-full mb-2" />
          <Skeleton variant="line" className="h-4 w-3/4" />
        </div>
      }
    >
      <MatrixContent />
    </Suspense>
  );
}

function MatrixContent() {
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<
    "all" | "pending" | "partial" | "complete"
  >("all");
  const [documentId, setDocumentId] = useState<string>("");
  const [docs, setDocs] = useState<Array<{ id: string; filename: string }>>([]);
  const [selectedQs, setSelectedQs] = useState<Set<string>>(new Set());
  const [selectedTpls, setSelectedTpls] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/documents?limit=300")
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []))
      .catch(console.error);
  }, []);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (documentId) p.set("documentId", documentId);
      if (stateFilter !== "all") p.set("status", stateFilter);
      const res = await fetch(`/api/questions/matrix?${p}`);
      const json = (await res.json()) as MatrixResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [documentId, stateFilter]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  useEffect(() => {
    setSelectedQs(new Set());
  }, [documentId, stateFilter]);

  const togQ = (id: string) => {
    setSelectedQs((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const togT = (id: string) => {
    setSelectedTpls((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const cellsToGenerate = useMemo(() => {
    if (!data) return 0;
    let count = 0;
    for (const qId of selectedQs) {
      const row = data.rows.find((r) => r.id === qId);
      if (!row) continue;
      for (const tId of selectedTpls) {
        const cell = row.byTemplate[tId];
        if (!cell || cell.status === "PENDING" || cell.status === "ERROR")
          count++;
      }
    }
    return count;
  }, [selectedQs, selectedTpls, data]);

  const submit = async () => {
    if (cellsToGenerate === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/deliverables/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: Array.from(selectedQs),
          templateIds: Array.from(selectedTpls),
        }),
      });
      if (!res.ok) throw new Error("HTTP error");
      toast.success(`Generación encolada (${cellsToGenerate} producciones)`);
      setSelectedQs(new Set());
      setSelectedTpls(new Set());
      // Polling progresivo durante 30s para mostrar progreso del batch
      let attempts = 0;
      const poll = setInterval(() => {
        attempts += 1;
        fetchMatrix();
        if (attempts >= 10) clearInterval(poll);
      }, 3000);
    } catch {
      toast.error("Error al encolar producciones");
    } finally {
      setSubmitting(false);
    }
  };

  const renderCell = (status: CellStatus) => {
    if (!status || status === "PENDING")
      return (
        <Clock
          className="size-4 inline-block"
          style={{ color: "var(--fg-subtle)" }}
        />
      );
    if (status === "GENERATING")
      return (
        <Loader2
          className="size-4 inline-block animate-spin"
          style={{ color: "var(--accent)" }}
        />
      );
    if (status === "COMPLETE")
      return (
        <CheckCircle2
          className="size-4 inline-block"
          style={{ color: "var(--color-success-fg)" }}
        />
      );
    if (status === "ERROR")
      return (
        <XCircle
          className="size-4 inline-block"
          style={{ color: "var(--color-danger-fg)" }}
        />
      );
    return null;
  };

  return (
    <div className="app-page-wide">
      <Link
        href="/questions"
        className={cn(
          "inline-flex items-center gap-2 h-7 px-2.5 -ml-2.5 mb-3 text-xs font-medium rounded-md",
          "bg-transparent text-[var(--fg-default)] hover:bg-[var(--bg-hover)]",
          "transition-colors duration-[var(--duration-instant)]",
        )}
      >
        <ArrowLeft className="size-4" />
        Volver a preguntas
      </Link>

      <h1
        className="serif-title text-[36px] leading-tight m-0 text-[var(--color-ink-1000)] inline-flex items-center gap-2"
        style={{ fontWeight: 700 }}
      >
        <TableIcon className="size-7 text-[var(--fg-muted)]" />
        Matriz de producción
      </h1>
      <p
        className="text-[14px] text-[var(--fg-muted)] max-w-[800px]"
        style={{ margin: "6px 0 24px" }}
      >
        Selecciona preguntas (filas) y templates (columnas) para generar
        producciones masivamente. Cada celda muestra el estado de ese par
        pregunta×template.
      </p>

      {/* Filter toolbar */}
      <Card variant="default" size="sm" className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className={cn(
              "h-9 px-3 text-sm rounded-md",
              "bg-[var(--bg-page)] text-[var(--fg-default)]",
              "border border-[var(--border-default)]",
              "hover:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)]",
            )}
            style={{ width: 280 }}
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
          >
            <option value="">— Filtrar por documento (todos) —</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.filename}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={fetchMatrix}>
            <RotateCw className="size-4" />
            Recargar
          </Button>
          {cellsToGenerate > 0 && (
            <div className="relative">
              <Button
                variant="primary"
                isLoading={submitting}
                onClick={submit}
                leadingIcon={!submitting ? <Zap className="size-4" /> : undefined}
              >
                Producir {cellsToGenerate} producciones
              </Button>
              <span
                className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold text-[var(--fg-inverted)]"
                style={{ background: "var(--color-danger-fg)" }}
              >
                {cellsToGenerate}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* State tabs */}
      <Tabs
        value={stateFilter}
        onValueChange={(k) => setStateFilter(k as typeof stateFilter)}
        className="mb-4"
      >
        <TabsList variant="underline">
          <TabsTrigger value="all">
            Todas ({data?.counts.all ?? 0})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Sin producción ({data?.counts.pending ?? 0})
          </TabsTrigger>
          <TabsTrigger value="partial">
            Parciales ({data?.counts.partial ?? 0})
          </TabsTrigger>
          <TabsTrigger value="complete">
            Completas ({data?.counts.complete ?? 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <Card variant="default" size="md">
          <div className="space-y-2">
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-11/12" />
            <Skeleton variant="line" className="h-4 w-10/12" />
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-9/12" />
            <Skeleton variant="line" className="h-4 w-11/12" />
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-10/12" />
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-11/12" />
            <Skeleton variant="line" className="h-4 w-9/12" />
            <Skeleton variant="line" className="h-4 w-10/12" />
          </div>
        </Card>
      ) : !data || data.rows.length === 0 ? (
        <Card variant="default" size="md">
          <div className="py-12 text-center">
            <TableIcon className="size-10 text-[var(--fg-subtle)] mx-auto mb-3" />
            <div className="text-[13px] text-[var(--fg-muted)]">
              Sin preguntas con estos filtros
            </div>
          </div>
        </Card>
      ) : (
        <Card variant="default" size="sm" className="p-0 overflow-hidden">
          <div className="overflow-x-auto relative">
            <table
              className="w-full"
              style={{ minWidth: 800, borderCollapse: "collapse" }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--bg-muted)",
                    borderBottom: "2px solid var(--border-default)",
                  }}
                >
                  <th
                    className="p-2.5 text-center text-[12px]"
                    style={{
                      borderBottom: "1px solid var(--border-default)",
                      position: "sticky",
                      left: 0,
                      background: "var(--bg-muted)",
                      zIndex: 2,
                    }}
                  >
                    <Checkbox
                      checked={
                        selectedQs.size === data.rows.length &&
                        data.rows.length > 0
                          ? true
                          : selectedQs.size > 0 &&
                              selectedQs.size < data.rows.length
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(c) => {
                        if (c === true)
                          setSelectedQs(
                            new Set(data.rows.map((r) => r.id)),
                          );
                        else setSelectedQs(new Set());
                      }}
                    />
                  </th>
                  <th
                    className="p-2.5 text-left text-[12px] text-[var(--fg-muted)]"
                    style={{
                      width: "30%",
                      position: "sticky",
                      left: 40,
                      background: "var(--bg-muted)",
                      zIndex: 2,
                    }}
                  >
                    Pregunta
                  </th>
                  {data.templates.map((t) => (
                    <th
                      key={t.id}
                      className="p-2.5 text-center text-[12px] text-[var(--fg-muted)]"
                      style={{ width: 90 }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Checkbox
                          checked={selectedTpls.has(t.id)}
                          onCheckedChange={() => togT(t.id)}
                        />
                        <Tooltip content={t.name}>
                          <span className="text-[18px]">{t.icon}</span>
                        </Tooltip>
                        <span
                          className="block text-[10px] text-[var(--fg-muted)] truncate"
                          style={{ maxWidth: 80 }}
                        >
                          {t.name}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th
                    className="p-2.5 text-center text-[12px] text-[var(--fg-muted)]"
                    style={{ width: 80 }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const selected = selectedQs.has(row.id);
                  const rowBg = selected
                    ? "color-mix(in oklab, var(--accent) 6%, transparent)"
                    : "var(--bg-page)";
                  return (
                    <tr
                      key={row.id}
                      style={{
                        background: rowBg,
                        borderBottom: "1px solid var(--border-default)",
                      }}
                    >
                      <td
                        className="p-2.5 text-center"
                        style={{
                          position: "sticky",
                          left: 0,
                          background: rowBg,
                          zIndex: 1,
                        }}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => togQ(row.id)}
                        />
                      </td>
                      <td
                        className="p-2.5"
                        style={{
                          position: "sticky",
                          left: 40,
                          background: rowBg,
                          zIndex: 1,
                        }}
                      >
                        <div
                          className="flex flex-col gap-1"
                          style={{ maxWidth: 480 }}
                        >
                          <span
                            className="text-[var(--fg-default)]"
                            style={{ fontSize: 13, lineHeight: 1.45 }}
                          >
                            {row.pregunta}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            <PeriodBadge
                              code={row.periodoCode}
                              size="xs"
                              variant="subtle"
                            />
                            <CategoryChip
                              code={row.categoriaCode}
                              size="xs"
                              variant="subtle"
                            />
                          </div>
                        </div>
                      </td>
                      {data.templates.map((t) => {
                        const cell = row.byTemplate[t.id];
                        const isProducible =
                          selected &&
                          selectedTpls.has(t.id) &&
                          (!cell ||
                            cell.status === "PENDING" ||
                            cell.status === "ERROR");
                        return (
                          <td
                            key={t.id}
                            className="p-2.5 text-center"
                            style={{
                              background: isProducible
                                ? "color-mix(in oklab, var(--accent) 10%, transparent)"
                                : "transparent",
                            }}
                          >
                            {cell?.deliverableId &&
                            cell.status === "COMPLETE" ? (
                              <Link
                                href={`/producciones/${cell.deliverableId}`}
                              >
                                {renderCell(cell.status)}
                              </Link>
                            ) : (
                              renderCell(cell?.status ?? null)
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2.5 text-center">
                        <span
                          className="text-[12px] tabular-nums"
                          style={{
                            color:
                              row.completedCount > 0
                                ? "var(--color-success-fg)"
                                : "var(--fg-subtle)",
                          }}
                        >
                          {row.completedCount}/{data.totalTemplates}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
