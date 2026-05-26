"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Rocket,
  FileText,
  AlertCircle,
  CheckCircle,
  Circle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Skeleton,
} from "@/components/ui";
import { PeriodBadge } from "@/components/domain/period-badge";
import { CategoryChip } from "@/components/domain/category-chip";
import { getDocumentDisplayName } from "@/lib/enrichment-types";
import { computeTargetCount } from "@/lib/questions-config";
import { cn } from "@/lib/cn";

interface DocumentWithQuestions {
  id: string;
  filename: string;
  metadata?: Record<string, unknown>;
  status: string;
  _count: { chunks: number; questions: number };
  latestDate?: string | null;
}

interface ProgressStep {
  step: string;
  message: string;
  done: boolean;
}

interface GeneratedQuestion {
  index: number;
  pregunta: string;
  periodoNombre: string;
  categoriaNombre: string;
  periodoCode?: string;
  categoriaCode?: string;
}

const STEPS_DEF = [
  { step: "fetching_chunks", message: "Obteniendo chunks del documento" },
  { step: "selecting_chunks", message: "Preparando contexto completo del libro" },
  { step: "calling_claude", message: "Llamando a Claude Opus 4.7" },
  { step: "parsing", message: "Procesando preguntas" },
];

export default function GenerateQuestionsPage() {
  return (
    <Suspense
      fallback={
        <div className="app-page">
          <Skeleton variant="line" className="h-8 w-64 mb-4" />
          <Skeleton variant="line" className="h-4 w-full mb-2" />
          <Skeleton variant="line" className="h-4 w-3/4" />
        </div>
      }
    >
      <GenerateContent />
    </Suspense>
  );
}

function GenerateContent() {
  const params = useSearchParams();
  const initialDocId = params.get("documentId") ?? "";

  const [docs, setDocs] = useState<DocumentWithQuestions[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>(initialDocId);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/documents?limit=300&status=READY");
      const d = await r.json();
      const list: DocumentWithQuestions[] = d.documents ?? [];
      const enriched = await Promise.all(
        list.map(async (doc) => {
          try {
            const qRes = await fetch(`/api/documents/${doc.id}/questions`);
            const qData = await qRes.json();
            return {
              ...doc,
              _count: { ...doc._count, questions: qData.count ?? 0 },
              latestDate: qData.latestDate,
            };
          } catch {
            return { ...doc, _count: { ...doc._count, questions: 0 } };
          }
        }),
      );
      setDocs(enriched);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const selected = docs.find((d) => d.id === selectedDoc);
  const hasQuestions = (selected?._count.questions ?? 0) > 0;
  const projectedN = selected ? computeTargetCount(selected._count.chunks) : 0;

  const handleGenerate = async () => {
    if (!selectedDoc) return;
    setGenerating(true);
    setProgress([]);
    setQuestions([]);
    setError(null);
    setDone(false);

    const verifyAfterFailure = async () => {
      try {
        const res = await fetch(`/api/documents/${selectedDoc}/questions`);
        const d = await res.json();
        if ((d.count ?? 0) > 0) {
          setDone(true);
          setError(
            "Conexión perdida con el stream, pero las preguntas se generaron correctamente. Recarga para verlas.",
          );
          loadDocs();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };

    let sawComplete = false;
    let sawAny = false;
    try {
      const res = await fetch(
        `/api/documents/${selectedDoc}/questions/generate`,
        { method: "POST" },
      );
      if (!res.body) throw new Error("Sin stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "progress") {
              setProgress((p) => {
                const exists = p.find((s) => s.step === ev.step);
                if (exists)
                  return p.map((s) =>
                    s.step === ev.step ? { ...s, done: true } : s,
                  );
                const def = STEPS_DEF.find((s) => s.step === ev.step);
                return [
                  ...p.map((s) => ({ ...s, done: true })),
                  { step: ev.step, message: def?.message ?? ev.message, done: false },
                ];
              });
            }
            if (ev.type === "question") {
              sawAny = true;
              setProgress((p) => p.map((s) => ({ ...s, done: true })));
              setQuestions((p) => [
                ...p,
                {
                  index: ev.index,
                  pregunta: ev.question.pregunta,
                  periodoNombre: ev.question.periodoNombre,
                  categoriaNombre: ev.question.categoriaNombre,
                  periodoCode: ev.question.periodoCode,
                  categoriaCode: ev.question.categoriaCode,
                },
              ]);
            }
            if (ev.type === "complete") {
              sawComplete = true;
              setProgress((p) => p.map((s) => ({ ...s, done: true })));
              setDone(true);
              loadDocs();
            }
            if (ev.type === "error") setError(ev.message);
          } catch {
            /* skip */
          }
        }
      }
      if (!sawComplete) {
        const recovered = await verifyAfterFailure();
        if (!recovered)
          setError(
            sawAny
              ? "Stream interrumpido. Verifica recargando."
              : "Stream cerrado sin preguntas. Reintenta.",
          );
      }
    } catch (err) {
      const recovered = await verifyAfterFailure();
      if (!recovered)
        setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="app-page">
        <Skeleton variant="line" className="h-4 w-32 mb-3" />
        <Skeleton variant="line" className="h-8 w-72 mb-2" />
        <Skeleton variant="line" className="h-4 w-full mb-1" />
        <Skeleton variant="line" className="h-4 w-3/4 mb-6" />
        <Skeleton variant="block" className="h-24 w-full mb-3" />
        <Skeleton variant="block" className="h-32 w-full" />
      </div>
    );
  }

  const ready = docs.filter((d) => d.status === "READY");
  const withQ = docs.filter((d) => d._count.questions > 0).length;
  const progressPct =
    projectedN > 0 ? Math.round((questions.length / projectedN) * 100) : 0;

  return (
    <div className="app-page">
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
        className="serif-title text-[36px] leading-tight m-0 text-[var(--color-ink-1000)]"
        style={{ fontWeight: 700 }}
      >
        Generar preguntas de investigación
      </h1>
      <p
        className="text-[14px] text-[var(--fg-muted)] max-w-[720px]"
        style={{ margin: "6px 0 24px" }}
      >
        Claude Opus 4.7 lee el corpus completo del documento y genera preguntas
        de investigación clasificadas por período histórico, categoría temática y
        subcategoría. El número se adapta al tamaño del libro.
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card variant="default" size="sm">
          <div className="text-center">
            <div className="text-[24px] font-semibold text-[var(--fg-default)] tabular-nums">
              {ready.length}
            </div>
            <div className="text-[12px] text-[var(--fg-muted)]">
              Documentos disponibles
            </div>
          </div>
        </Card>
        <Card variant="default" size="sm">
          <div className="text-center">
            <div
              className="text-[24px] font-semibold tabular-nums"
              style={{ color: "var(--color-success-fg)" }}
            >
              {withQ}
            </div>
            <div className="text-[12px] text-[var(--fg-muted)]">
              Con preguntas
            </div>
          </div>
        </Card>
        <Card variant="default" size="sm">
          <div className="text-center">
            <div
              className="text-[24px] font-semibold tabular-nums"
              style={{ color: "var(--color-warning-fg)" }}
            >
              {ready.length - withQ}
            </div>
            <div className="text-[12px] text-[var(--fg-muted)]">Pendientes</div>
          </div>
        </Card>
      </div>

      {/* Document selector */}
      <Card variant="default" size="md" className="mb-4">
        <h3 className="text-[15px] font-semibold text-[var(--fg-default)] mb-3">
          Seleccionar documento
        </h3>

        <select
          className={cn(
            "w-full h-10 px-3 text-sm rounded-md",
            "bg-[var(--bg-page)] text-[var(--fg-default)]",
            "border border-[var(--border-default)]",
            "hover:border-[var(--border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--ring-focus)]",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
          value={selectedDoc}
          onChange={(e) => {
            setSelectedDoc(e.target.value);
            setProgress([]);
            setQuestions([]);
            setError(null);
            setDone(false);
          }}
          disabled={generating}
        >
          <option value="">— Selecciona un documento —</option>
          {ready.map((d) => (
            <option key={d.id} value={d.id}>
              {d._count.questions > 0 ? "✓ " : "○ "}
              {getDocumentDisplayName(d)}
              {d._count.questions > 0
                ? ` (${d._count.questions} preguntas)`
                : ""}
            </option>
          ))}
        </select>

        {selected && (
          <div
            className="mt-4 p-4 rounded-md flex items-center gap-4 flex-wrap"
            style={{ background: "var(--bg-muted)" }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-semibold text-[var(--fg-default)]">
                  {getDocumentDisplayName(selected)}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="subtle" size="xs">
                    {selected._count.chunks} chunks
                  </Badge>
                  {hasQuestions ? (
                    <Badge variant="success" size="xs">
                      <CheckCircle2 className="size-3" />
                      {selected._count.questions} preguntas
                    </Badge>
                  ) : (
                    <Badge variant="subtle" size="xs">
                      Sin preguntas
                    </Badge>
                  )}
                  {hasQuestions && (
                    <Link
                      href={`/questions?documentId=${selected.id}`}
                      className="text-[12px] text-[var(--accent)] hover:underline"
                    >
                      Ver preguntas →
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-[var(--fg-muted)]">
                N adaptativo
              </div>
              <div
                className="font-mono tabular-nums"
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  color: "var(--accent)",
                }}
              >
                {projectedN}
              </div>
            </div>
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          fullWidth
          isLoading={generating}
          disabled={!selectedDoc || generating}
          onClick={handleGenerate}
          className="mt-4"
          leadingIcon={!generating ? <Rocket className="size-4" /> : undefined}
        >
          {generating
            ? "Generando…"
            : hasQuestions
              ? `Regenerar ${projectedN} preguntas`
              : `Generar ${projectedN} preguntas`}
        </Button>
      </Card>

      {(generating || progress.length > 0) && (
        <Card variant="default" size="md" className="mb-4">
          <h3 className="text-[15px] font-semibold text-[var(--fg-default)] mb-4">
            Progreso
          </h3>

          {/* Steps vertical */}
          <ol className="flex flex-col gap-3 list-none p-0 m-0">
            {STEPS_DEF.map((s, i) => {
              const step = progress.find((p) => p.step === s.step);
              const isDone = step?.done;
              const isCurrent = !isDone && step;
              const isPast = i < progress.length;
              const status: "done" | "process" | "wait" = isDone
                ? "done"
                : isCurrent
                  ? "process"
                  : isPast
                    ? "done"
                    : "wait";
              return (
                <li key={s.step} className="flex items-center gap-3">
                  {status === "done" ? (
                    <CheckCircle
                      className="size-5 shrink-0"
                      style={{ color: "var(--color-success-fg)" }}
                    />
                  ) : status === "process" ? (
                    <div
                      className="size-5 shrink-0 rounded-full border-2 border-t-transparent animate-spin"
                      style={{
                        borderColor: "var(--accent)",
                        borderTopColor: "transparent",
                      }}
                      aria-label="En proceso"
                    />
                  ) : (
                    <Circle
                      className="size-5 shrink-0"
                      style={{ color: "var(--fg-subtle)" }}
                    />
                  )}
                  <span
                    className="text-[14px]"
                    style={{
                      color:
                        status === "wait"
                          ? "var(--fg-subtle)"
                          : "var(--fg-default)",
                    }}
                  >
                    {s.message}
                  </span>
                </li>
              );
            })}
          </ol>

          {questions.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[13px] text-[var(--fg-muted)]">
                  Preguntas generadas
                </span>
                <span className="text-[13px] font-semibold text-[var(--fg-default)] tabular-nums">
                  {questions.length} / {projectedN}
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: "var(--bg-muted)" }}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: "var(--accent)",
                  }}
                />
              </div>
            </div>
          )}
        </Card>
      )}

      {error && (
        <div
          className="mb-4 p-3 rounded-lg flex items-start gap-3"
          style={{
            background: "var(--color-warning-bg)",
            border: "1px solid color-mix(in oklab, var(--color-warning-fg) 30%, transparent)",
          }}
        >
          <AlertCircle
            className="size-4 mt-0.5 shrink-0"
            style={{ color: "var(--color-warning-fg)" }}
          />
          <div
            className="flex-1 text-[13px]"
            style={{ color: "var(--color-warning-fg)" }}
          >
            {error}
          </div>
        </div>
      )}

      {done && (
        <div
          className="mb-4 p-3 rounded-lg flex items-center gap-3 flex-wrap"
          style={{
            background: "var(--color-success-bg)",
            border:
              "1px solid color-mix(in oklab, var(--color-success-fg) 30%, transparent)",
          }}
        >
          <CheckCircle2
            className="size-4 shrink-0"
            style={{ color: "var(--color-success-fg)" }}
          />
          <div
            className="flex-1 text-[13px] font-medium"
            style={{ color: "var(--color-success-fg)" }}
          >
            {questions.length} preguntas generadas correctamente
          </div>
          <Link
            href={`/questions?documentId=${selectedDoc}`}
            className={cn(
              "inline-flex items-center justify-center gap-2 h-7 px-2.5 text-xs font-medium rounded-md",
              "bg-[var(--accent)] text-[var(--fg-inverted)] hover:bg-[var(--accent-hover)]",
              "transition-colors duration-[var(--duration-instant)]",
            )}
          >
            Ver todas →
          </Link>
        </div>
      )}

      {questions.length > 0 && (
        <Card variant="default" size="md">
          <h3 className="text-[15px] font-semibold text-[var(--fg-default)] mb-3">
            Preguntas en streaming ({questions.length})
          </h3>
          <div className="flex flex-col gap-2 w-full">
            {questions.map((q) => {
              const periodColorVar = q.periodoCode
                ? `var(--color-period-${(q.periodoCode || "").toLowerCase().replace(/_/g, "-")})`
                : "var(--accent)";
              return (
                <Card
                  key={q.index}
                  variant="default"
                  size="sm"
                  style={{ borderLeft: `3px solid ${periodColorVar}` }}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="subtle"
                        size="xs"
                        className="font-mono"
                      >
                        #{q.index}
                      </Badge>
                      {q.periodoCode && (
                        <PeriodBadge
                          code={q.periodoCode}
                          size="xs"
                          variant="subtle"
                        />
                      )}
                      {q.categoriaCode && (
                        <CategoryChip
                          code={q.categoriaCode}
                          size="xs"
                          variant="subtle"
                        />
                      )}
                    </div>
                    <span
                      className="text-[var(--fg-default)]"
                      style={{ fontSize: 13.5, lineHeight: 1.5 }}
                    >
                      {q.pregunta}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      )}

      {ready.length === 0 && (
        <Card variant="default" size="md">
          <div className="py-10 text-center">
            <FileText className="size-10 text-[var(--fg-subtle)] mx-auto mb-3" />
            <div className="text-[13px] text-[var(--fg-muted)]">
              Sin documentos listos.{" "}
              <Link
                href="/upload"
                className="text-[var(--accent)] hover:underline"
              >
                Sube un PDF
              </Link>{" "}
              para empezar.
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
