"use client";

import { useEffect, useState, useRef } from "react";
import {
  GitCompare,
  Send,
  Plus,
  X,
  Copy,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Button,
  IconButton,
  Textarea,
  Card,
  Badge,
  Chip,
  Tooltip,
  Spinner,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui";
import { CHAT_TEMPLATES, getTemplateById } from "@/lib/chat-templates";

interface CompareResult {
  templateId: string;
  status: "idle" | "loading" | "complete" | "error";
  answer: string;
  citations: Array<{ id: string; documentFilename?: string; pageNumber: number; similarity: number }>;
  totalChunksUsed?: number;
  error?: string;
}

const RAG_CONFIG = { topK: 100, similarityThreshold: 0.25 };

export default function ComparePage() {
  const [question, setQuestion] = useState("");
  const [templates, setTemplates] = useState<string[]>([
    "mini-ensayo",
    "ensayo-largo",
    "guion-tres-actos",
  ]);
  const [results, setResults] = useState<Record<string, CompareResult>>({});
  const [isRunning, setIsRunning] = useState(false);
  const pollersRef = useRef<Record<string, ReturnType<typeof setInterval> | null>>({});

  // Cleanup global on unmount
  useEffect(() => {
    return () => {
      for (const t of Object.values(pollersRef.current)) {
        if (t) clearInterval(t);
      }
    };
  }, []);

  const run = async () => {
    const q = question.trim();
    if (!q) return;
    setIsRunning(true);
    // reset
    const initial: Record<string, CompareResult> = {};
    for (const t of templates) {
      initial[t] = { templateId: t, status: "loading", answer: "", citations: [] };
    }
    setResults(initial);

    // Disparar todas las requests en paralelo
    await Promise.all(
      templates.map(async (templateId) => {
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: q,
              topK: RAG_CONFIG.topK,
              similarityThreshold: RAG_CONFIG.similarityThreshold,
              templateId,
            }),
          });
          if (!res.ok) {
            setResults((r) => ({ ...r, [templateId]: { ...r[templateId], status: "error", error: "HTTP error" } }));
            return;
          }
          const data = await res.json();
          setResults((r) => ({
            ...r,
            [templateId]: {
              ...r[templateId],
              citations: data.chunks || [],
              totalChunksUsed: data.totalChunksUsed,
            },
          }));

          // Poll
          pollersRef.current[templateId] = setInterval(async () => {
            try {
              const poll = await fetch(`/api/chat/${data.id}`);
              if (!poll.ok) return;
              const pd = await poll.json();
              if (pd.status === "COMPLETE") {
                clearInterval(pollersRef.current[templateId]!);
                pollersRef.current[templateId] = null;
                setResults((r) => ({ ...r, [templateId]: { ...r[templateId], status: "complete", answer: pd.answer } }));
              } else if (pd.status === "ERROR") {
                clearInterval(pollersRef.current[templateId]!);
                pollersRef.current[templateId] = null;
                setResults((r) => ({ ...r, [templateId]: { ...r[templateId], status: "error", error: pd.answer } }));
              }
            } catch {
              /* retry */
            }
          }, 2000);
        } catch {
          setResults((r) => ({ ...r, [templateId]: { ...r[templateId], status: "error", error: "Error de red" } }));
        }
      }),
    );

    // Espera hasta que todos terminen
    const checkDone = setInterval(() => {
      const all = Object.values(pollersRef.current).every((v) => v === null);
      if (all) {
        clearInterval(checkDone);
        setIsRunning(false);
      }
    }, 1000);
  };

  const addTemplate = (tplId: string) => {
    if (templates.includes(tplId) || templates.length >= 3) return;
    setTemplates([...templates, tplId]);
  };

  const removeTemplate = (tplId: string) => {
    setTemplates(templates.filter((t) => t !== tplId));
  };

  const availableTemplates = CHAT_TEMPLATES.filter((t) => !templates.includes(t.id));
  // 3 = grid-cols-3, 2 = grid-cols-2, 1 = grid-cols-1
  const gridColsClass =
    templates.length >= 3
      ? "lg:grid-cols-3"
      : templates.length === 2
        ? "lg:grid-cols-2"
        : "lg:grid-cols-1";

  return (
    <div className="app-page-wide">
      {/* Header */}
      <header className="mb-6">
        <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
          Comparador
        </div>
        <h1
          className="serif-title text-[36px] leading-tight mt-1.5 mb-2 text-[var(--color-ink-1000)] flex items-center gap-3"
          style={{ fontWeight: 700 }}
        >
          <GitCompare className="size-8 text-[var(--accent)]" />
          Comparador de templates
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--fg-muted)] max-w-[720px]">
          Envía una misma pregunta a hasta 3 templates simultáneamente y compara
          las respuestas lado a lado.
        </p>
      </header>

      {/* Input form */}
      <Card variant="default" size="md" className="mb-4">
        <div className="flex flex-col gap-3.5 w-full">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Escribe la pregunta de investigación…"
            rows={3}
            disabled={isRunning}
            className="min-h-[72px]"
          />
          <div className="flex flex-wrap items-center gap-2">
            {templates.map((tid) => {
              const t = getTemplateById(tid);
              return (
                <Chip
                  key={tid}
                  variant="subtle"
                  size="sm"
                  onRemove={() => removeTemplate(tid)}
                  removeLabel={`Quitar ${t?.name ?? tid}`}
                >
                  <span className="mr-1">{t?.icon}</span>
                  {t?.name}
                </Chip>
              );
            })}
            {templates.length < 3 && availableTemplates.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Plus className="size-3.5" />}
                  >
                    Añadir template
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Templates disponibles</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableTemplates.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onSelect={() => addTemplate(t.id)}
                    >
                      <span className="mr-1.5">{t.icon}</span>
                      {t.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <div className="ml-auto">
              <Button
                variant="primary"
                onClick={run}
                isLoading={isRunning}
                disabled={!question.trim() || templates.length === 0}
                leadingIcon={<Send className="size-3.5" />}
              >
                Comparar
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Results */}
      {templates.length === 0 ? (
        <EmptyState
          icon={Inbox}
          description="Añade al menos un template para comparar"
        />
      ) : (
        <div className={`grid grid-cols-1 ${gridColsClass} gap-3`}>
          {templates.map((tid) => (
            <ResultColumn key={tid} templateId={tid} result={results[tid]} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── ResultColumn ────────────────────────────────────────────────────────── */

function ResultColumn({
  templateId,
  result,
}: {
  templateId: string;
  result?: CompareResult;
}) {
  const tpl = getTemplateById(templateId);

  return (
    <Card
      variant="default"
      size="sm"
      className="h-full flex flex-col p-0 overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-2 px-4 py-3 border-b border-[var(--border-default)]">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-[18px] leading-none mt-0.5">{tpl?.icon}</span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[var(--fg-default)] truncate">
              {tpl?.name}
            </div>
            <div className="text-[11px] text-[var(--fg-subtle)] line-clamp-2 mt-0.5">
              {tpl?.description}
            </div>
          </div>
        </div>
        {result?.status === "complete" && (
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="subtle" size="xs">
              {result.citations.length} citas
            </Badge>
            <Tooltip content="Copiar markdown">
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Copiar markdown"
                onClick={() => {
                  navigator.clipboard.writeText(result.answer);
                  toast.success("Copiado");
                }}
              >
                <Copy className="size-3.5" />
              </IconButton>
            </Tooltip>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 px-4 py-3 max-h-[640px] overflow-y-auto">
        {!result || result.status === "idle" ? (
          <EmptyState description="Sin resultado" icon={Inbox} compact />
        ) : result.status === "loading" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Spinner size={20} />
            <span className="text-[12px] text-[var(--fg-subtle)]">
              Generando…
            </span>
          </div>
        ) : result.status === "error" ? (
          <div className="p-3 rounded-md border border-[var(--color-danger-fg)]/40 bg-[var(--color-danger-bg)]">
            <div className="text-[13px] text-[var(--color-danger-fg)]">
              {result.error || "Error"}
            </div>
          </div>
        ) : (
          <div
            className="prose-academic max-w-full"
            style={{ fontSize: 13.5 }}
          >
            <ReactMarkdown>{result.answer}</ReactMarkdown>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─── EmptyState ──────────────────────────────────────────────────────────── */

function EmptyState({
  description,
  icon: Icon,
  compact = false,
}: {
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-8" : "py-16"
      }`}
    >
      {Icon && (
        <Icon
          className={`${
            compact ? "size-5" : "size-8"
          } text-[var(--fg-subtle)] mb-2`}
        />
      )}
      <div className="text-[13px] text-[var(--fg-muted)]">{description}</div>
    </div>
  );
}
