"use client";

import { useEffect, useRef, useState } from "react";
import {
  Lightbulb,
  Rocket,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Button, Textarea, Card, Badge, Spinner } from "@/components/ui";
import { ProseBlock } from "@/components/domain/prose-block";

interface SideResult {
  status: "idle" | "loading" | "complete" | "error";
  answer: string;
  citations: Array<{ id: string; documentFilename?: string; pageNumber: number; similarity: number }>;
  totalChunksUsed?: number;
}

export default function HypothesisPage() {
  const [hypothesis, setHypothesis] = useState("");
  const [forResult, setForResult] = useState<SideResult>({ status: "idle", answer: "", citations: [] });
  const [againstResult, setAgainstResult] = useState<SideResult>({ status: "idle", answer: "", citations: [] });
  const [running, setRunning] = useState(false);
  const forPoller = useRef<ReturnType<typeof setInterval> | null>(null);
  const againstPoller = useRef<ReturnType<typeof setInterval> | null>(null);

  const runSide = async (
    setResult: (r: SideResult) => void,
    pollerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
    question: string,
  ) => {
    setResult({ status: "loading", answer: "", citations: [] });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          topK: 100,
          similarityThreshold: 0.25,
          templateId: "mini-ensayo",
        }),
      });
      if (!res.ok) throw new Error("HTTP error");
      const data = await res.json();
      setResult({
        status: "loading",
        answer: "",
        citations: data.chunks ?? [],
        totalChunksUsed: data.totalChunksUsed,
      });
      pollerRef.current = setInterval(async () => {
        const poll = await fetch(`/api/chat/${data.id}`);
        if (!poll.ok) return;
        const pd = await poll.json();
        if (pd.status === "COMPLETE") {
          clearInterval(pollerRef.current!);
          pollerRef.current = null;
          setResult({
            status: "complete",
            answer: pd.answer,
            citations: data.chunks ?? [],
            totalChunksUsed: data.totalChunksUsed,
          });
        } else if (pd.status === "ERROR") {
          clearInterval(pollerRef.current!);
          pollerRef.current = null;
          setResult({ status: "error", answer: pd.answer || "Error", citations: [] });
        }
      }, 2000);
    } catch {
      setResult({ status: "error", answer: "Error de red", citations: [] });
    }
  };

  // Limpiar pollers al desmontar
  useEffect(() => {
    return () => {
      if (forPoller.current) clearInterval(forPoller.current);
      if (againstPoller.current) clearInterval(againstPoller.current);
    };
  }, []);

  const run = async () => {
    const h = hypothesis.trim();
    if (h.length < 10) {
      toast.warning("La hipótesis necesita al menos 10 caracteres.");
      return;
    }
    setRunning(true);
    if (forPoller.current) clearInterval(forPoller.current);
    if (againstPoller.current) clearInterval(againstPoller.current);

    await Promise.all([
      runSide(
        setForResult,
        forPoller,
        `Evalúa la siguiente hipótesis histórica y busca evidencia EN FAVOR. Cita pasajes específicos del corpus que la respalden, con razonamiento claro.\n\nHIPÓTESIS:\n"${h}"\n\nResponde con un mini-ensayo de evidencia favorable, argumentando por qué los hechos del corpus respaldan esta tesis. Incluye citas [#N] obligatorias.`,
      ),
      runSide(
        setAgainstResult,
        againstPoller,
        `Evalúa la siguiente hipótesis histórica y busca evidencia EN CONTRA. Cita pasajes que la cuestionen, matizan o refutan, con razonamiento claro.\n\nHIPÓTESIS:\n"${h}"\n\nResponde con un mini-ensayo crítico que problematice esta tesis basándote en evidencia del corpus. Incluye citas [#N] obligatorias.`,
      ),
    ]);

    const checkDone = setInterval(() => {
      if (!forPoller.current && !againstPoller.current) {
        clearInterval(checkDone);
        setRunning(false);
      }
    }, 1000);
  };

  return (
    <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
      {/* Hero */}
      <header className="mb-5">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
          Plataforma de investigación
        </div>
        <h1
          className="serif-title text-[36px] leading-tight mt-1.5 mb-2 text-[var(--color-ink-1000)] flex items-center gap-3"
          style={{ fontWeight: 700 }}
        >
          <Lightbulb className="size-8 text-[var(--accent)]" />
          Sistema de hipótesis
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--fg-muted)] max-w-[720px]">
          Plantea una hipótesis histórica y el sistema buscará evidencia{" "}
          <span className="font-semibold text-[var(--color-success-fg)]">a favor</span>{" "}
          y{" "}
          <span className="font-semibold text-[var(--color-danger-fg)]">en contra</span>{" "}
          en el corpus, presentándolas lado a lado. Útil para tesis, historiografía o argumentación.
        </p>
      </header>

      {/* Input */}
      <Card variant="default" size="md" className="mb-4">
        <div className="flex flex-col gap-3">
          <Textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            placeholder='Ej: "El Frente Nacional consolidó la exclusión política y sembró las condiciones del conflicto armado contemporáneo."'
            rows={3}
            disabled={running}
            className="min-h-[88px] max-h-[200px]"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="primary"
              size="lg"
              leadingIcon={<Rocket className="size-4" />}
              isLoading={running}
              disabled={hypothesis.trim().length < 10}
              onClick={run}
            >
              Buscar evidencia
            </Button>
            <span className="text-xs text-[var(--fg-subtle)]">
              Se ejecutan dos consultas RAG en paralelo. ~30–60s.
            </span>
          </div>
        </div>
      </Card>

      {/* Hipótesis evaluada */}
      {(forResult.status !== "idle" || againstResult.status !== "idle") && hypothesis.trim() && (
        <Card
          variant="default"
          size="sm"
          className="mb-4 border-l-[3px] border-l-[var(--accent)]"
        >
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
            Hipótesis evaluada
          </div>
          <p
            className="mt-1.5 text-[15px] leading-snug text-[var(--fg-default)]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {hypothesis.trim()}
          </p>
        </Card>
      )}

      {/* Resultados lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SideCard
          title="Evidencia a favor"
          icon={<CheckCircle2 className="size-4" />}
          accentVar="--color-success-fg"
          result={forResult}
        />
        <SideCard
          title="Evidencia en contra"
          icon={<XCircle className="size-4" />}
          accentVar="--color-danger-fg"
          result={againstResult}
        />
      </div>
    </div>
  );
}

/* ─── Sub-componentes ────────────────────────────────────────────────────── */

function SideCard({
  title,
  icon,
  accentVar,
  result,
}: {
  title: string;
  icon: React.ReactNode;
  accentVar: string;
  result: SideResult;
}) {
  const badgeVariant = accentVar === "--color-success-fg" ? "success" : "danger";

  return (
    <Card
      variant="default"
      size="md"
      className="min-h-[380px] relative overflow-hidden"
      style={{ boxShadow: `inset 0 3px 0 var(${accentVar})` }}
    >
      <header className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <span style={{ color: `var(${accentVar})` }}>{icon}</span>
          <h3 className="text-[15px] font-semibold text-[var(--fg-default)]">
            {title}
          </h3>
        </div>
        {result.status === "complete" && (
          <Badge variant={badgeVariant} size="xs">
            {result.citations.length} fuentes
          </Badge>
        )}
      </header>

      {result.status === "idle" && (
        <div className="py-10 text-center">
          <FileText className="size-8 mx-auto mb-2 text-[var(--fg-subtle)] opacity-60" />
          <div className="text-[13px] text-[var(--fg-subtle)]">Sin ejecutar</div>
        </div>
      )}

      {result.status === "loading" && (
        <div className="py-10 text-center">
          <Spinner size={20} className="mx-auto text-[var(--accent)]" />
          <p className="mt-3 text-[13px] text-[var(--fg-muted)]">
            Buscando en el corpus…
          </p>
        </div>
      )}

      {result.status === "error" && (
        <div className="p-4 rounded-md border border-[var(--color-danger-fg)]/40 bg-[var(--color-danger-bg)] flex items-start gap-3">
          <AlertCircle className="size-4 text-[var(--color-danger-fg)] mt-0.5 shrink-0" />
          <div className="text-sm text-[var(--color-danger-fg)]">{result.answer}</div>
        </div>
      )}

      {result.status === "complete" && (
        <ProseBlock width="prose" className="text-sm max-w-full">
          <ReactMarkdown>{result.answer}</ReactMarkdown>
        </ProseBlock>
      )}
    </Card>
  );
}
