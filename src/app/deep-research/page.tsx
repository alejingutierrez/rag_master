"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Rocket,
  Search,
  Lightbulb,
  Zap,
  BookOpen,
  FileSearch,
  Calendar,
  Users,
  History,
  FlaskConical,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Circle,
  XCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  Button,
  Card,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Skeleton,
  Separator,
} from "@/components/ui";
import { cn } from "@/lib/cn";

interface Subquery {
  query: string;
  status: "pending" | "running" | "done" | "error";
  foundChunks?: number;
  error?: string;
}

interface ChunkMeta {
  id: string;
  documentFilename?: string;
  pageNumber?: number;
  similarity?: number;
  content?: string;
}

interface ResearchPlan {
  thinking: string;
  scope: string;
  entities: {
    personas: string[];
    instituciones: string[];
    lugares: string[];
    conceptos: string[];
    temporalidad: string;
  };
  subqueries: string[];
}

interface DeepResearchMetadata {
  stage:
    | "planning"
    | "executing"
    | "fusing"
    | "synthesizing"
    | "annexes"
    | "persisting"
    | "complete"
    | "error";
  message?: string;
  plan?: ResearchPlan;
  subqueriesProgress?: Subquery[];
  paperWords?: number;
  startedAt?: string;
  finishedAt?: string;
}

interface DeepResearchData {
  id: string;
  status: "PENDING" | "GENERATING" | "COMPLETE" | "ERROR";
  userQuestion: string;
  answer: string;
  chunksUsed: ChunkMeta[];
  metadata: DeepResearchMetadata;
  createdAt: string;
  updatedAt: string;
  modelUsed: string;
}

export default function DeepResearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[var(--container-wide)] mx-auto px-8 py-6">
          <Skeleton variant="line" className="h-8 w-64 mb-3" />
          <Skeleton variant="block" className="h-40" />
        </div>
      }
    >
      <DeepResearchContent />
    </Suspense>
  );
}

function DeepResearchContent() {
  const router = useRouter();
  const params = useSearchParams();
  const idFromUrl = params.get("id");

  const [question, setQuestion] = useState("");
  const [data, setData] = useState<DeepResearchData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("paper");
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stage = data?.metadata?.stage ?? "planning";
  const isRunning = data?.status === "GENERATING" || data?.status === "PENDING";
  const isComplete = data?.status === "COMPLETE";
  const isError = data?.status === "ERROR";

  // ─── Fetch + polling de un deliverable ────────────────────────────────
  const fetchData = useCallback(async (id: string): Promise<DeepResearchData | null> => {
    try {
      const res = await fetch(`/api/deep-research?id=${id}`);
      if (!res.ok) throw new Error("Deep research no encontrado");
      const d = (await res.json()) as DeepResearchData;
      setData(d);
      setLoadError(null);
      return d;
    } catch (e) {
      setLoadError((e as Error).message);
      return null;
    }
  }, []);

  const startPolling = useCallback(
    (id: string) => {
      if (pollerRef.current) clearInterval(pollerRef.current);
      const tick = async () => {
        const d = await fetchData(id);
        if (!d || d.status === "COMPLETE" || d.status === "ERROR") {
          if (pollerRef.current) {
            clearInterval(pollerRef.current);
            pollerRef.current = null;
          }
        }
      };
      tick(); // immediate
      pollerRef.current = setInterval(tick, 3000);
    },
    [fetchData]
  );

  // ─── Cargar desde ?id= al montar ─────────────────────────────────────
  useEffect(() => {
    if (idFromUrl) startPolling(idFromUrl);
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [idFromUrl, startPolling]);

  // ─── Cuando se carga el deliverable, llenar el textarea con la pregunta ───
  useEffect(() => {
    if (data?.userQuestion && !question) setQuestion(data.userQuestion);
  }, [data?.userQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Submit ───────────────────────────────────────────────────────────
  const submit = async () => {
    const q = question.trim();
    if (q.length < 12) {
      toast.warning("Necesitas al menos 12 caracteres.");
      return;
    }
    setSubmitting(true);
    setData(null);
    setLoadError(null);
    setActiveTab("paper");

    try {
      const res = await fetch("/api/deep-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { deliverableId } = (await res.json()) as { deliverableId: string };
      router.replace(`/deep-research?id=${deliverableId}`);
      startPolling(deliverableId);
      toast.success("Investigación iniciada — procesará en background");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Sub-derivados ────────────────────────────────────────────────────
  const sections = parseSections(data?.answer ?? "");
  const plan = data?.metadata?.plan ?? null;
  const subqueries = data?.metadata?.subqueriesProgress ?? [];
  const totalSubqueries = subqueries.length || plan?.subqueries.length || 0;
  const doneSubqueries = subqueries.filter((s) => s.status === "done").length;

  const stepIndex =
    stage === "planning" ? 0 :
    stage === "executing" ? 1 :
    stage === "fusing" ? 2 :
    stage === "synthesizing" ? 3 :
    stage === "annexes" ? 4 :
    stage === "persisting" ? 5 :
    stage === "complete" ? 6 : 0;

  return (
    <div className="max-w-[var(--container-wide)] mx-auto px-8 py-6">
      <header className="mb-5">
        <h1
          className="serif-title text-[36px] leading-tight text-[var(--color-ink-1000)] inline-flex items-center gap-3"
          style={{ fontWeight: 700 }}
        >
          <Rocket className="size-7 text-[var(--accent)]" aria-hidden />
          Deep Research
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--fg-muted)] mt-1.5 max-w-[760px]">
          Investigación agéntica para preguntas amplias. Un planificador descompone tu pregunta
          en 6-8 sub-investigaciones, ejecuta RAG completo (expansion + BM25 + RRF + rerank)
          en cada una, fusiona la evidencia y sintetiza un <em>paper académico</em> con
          cronología, tabla de actores y vacíos del corpus. Tarda 5-10 min — corre en
          background, no necesitas mantener la pestaña abierta.
        </p>
      </header>

      <Card variant="default" size="md" className="mb-4">
        <div className="flex flex-col gap-3 w-full">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='"¿Cómo se construyó el imaginario nacional en Colombia entre 1850 y 1900, y qué papel jugó la prensa liberal en la disputa con la Iglesia?"'
            rows={4}
            className="min-h-[112px] max-h-[224px]"
            disabled={submitting || isRunning}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              leadingIcon={<FlaskConical className="size-4" />}
              isLoading={submitting}
              disabled={isRunning || question.trim().length < 12}
              onClick={submit}
            >
              {data ? "Nueva investigación" : "Iniciar investigación"}
            </Button>
            <Tooltip content="Opus 4.7 planifica y sintetiza; Sonnet 4.6 genera los anexos">
              <span className="text-xs text-[var(--fg-muted)] inline-flex items-center gap-1.5 cursor-help">
                <Lightbulb className="size-3.5" />
                Largo y costoso, pero riguroso
              </span>
            </Tooltip>
            {data?.id && isComplete && (
              <Button
                variant="link"
                size="md"
                leadingIcon={<BookOpen className="size-4" />}
                onClick={() => router.push(`/producciones/${data.id}`)}
              >
                Abrir en producciones
              </Button>
            )}
          </div>
        </div>
      </Card>

      {data && (
        <>
          {isRunning && (
            <Card variant="default" size="md" className="mb-4">
              <Steps
                current={stepIndex}
                status={isError ? "error" : "process"}
                items={[
                  { title: "Planificar", icon: Lightbulb },
                  { title: "Recuperar evidencia", icon: Search },
                  { title: "Fusionar", icon: Zap },
                  { title: "Sintetizar paper", icon: BookOpen },
                  { title: "Anexos", icon: FileSearch },
                  { title: "Guardar", icon: CheckCircle2 },
                ]}
              />
              {data.metadata?.message && (
                <p className="mt-3 mb-0 text-xs italic text-[var(--fg-muted)]">
                  {data.metadata.message}
                </p>
              )}
              {totalSubqueries > 0 && stage === "executing" && (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] transition-all duration-500"
                      style={{
                        width: `${Math.round((doneSubqueries / totalSubqueries) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-[var(--fg-subtle)] mt-1 tabular-nums">
                    {doneSubqueries} / {totalSubqueries} sub-investigaciones
                  </div>
                </div>
              )}
              {data.metadata?.paperWords !== undefined && stage === "synthesizing" && (
                <span className="text-xs text-[var(--fg-muted)] mt-2 inline-block">
                  Paper en curso: {data.metadata.paperWords} palabras
                </span>
              )}
            </Card>
          )}

          {plan && (
            <Card variant="inset" size="md" className="mb-4">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
                Plan del investigador
              </div>
              {plan.thinking && (
                <p className="mt-2 mb-2 text-[13px] italic text-[var(--fg-default)]">
                  {plan.thinking}
                </p>
              )}
              {plan.scope && (
                <p className="mb-2 text-[13px] text-[var(--fg-default)]">
                  <span className="font-semibold">Alcance: </span>
                  {plan.scope}
                </p>
              )}
              {plan.entities && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {plan.entities.temporalidad && (
                    <Badge variant="info" size="sm">
                      <Calendar className="size-3" />
                      {plan.entities.temporalidad}
                    </Badge>
                  )}
                  {plan.entities.personas?.slice(0, 8).map((p) => (
                    <Badge
                      key={p}
                      variant="subtle"
                      size="sm"
                      className="bg-[color-mix(in_oklab,var(--color-category-soc)_14%,transparent)] text-[var(--color-category-soc)]"
                    >
                      {p}
                    </Badge>
                  ))}
                  {plan.entities.instituciones?.slice(0, 6).map((p) => (
                    <Badge
                      key={p}
                      variant="warning"
                      size="sm"
                    >
                      {p}
                    </Badge>
                  ))}
                  {plan.entities.lugares?.slice(0, 6).map((p) => (
                    <Badge
                      key={p}
                      variant="success"
                      size="sm"
                    >
                      {p}
                    </Badge>
                  ))}
                  {plan.entities.conceptos?.slice(0, 6).map((p) => (
                    <Badge
                      key={p}
                      variant="subtle"
                      size="sm"
                      className="bg-[color-mix(in_oklab,var(--color-category-cul)_14%,transparent)] text-[var(--color-category-cul)]"
                    >
                      {p}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          )}

          {subqueries.length > 0 && (
            <Card variant="default" size="md" className="mb-4">
              <header className="mb-3">
                <h3 className="text-[15px] font-semibold text-[var(--fg-default)]">
                  Sub-investigaciones ({subqueries.length})
                </h3>
              </header>
              <div className="flex flex-col gap-1.5 w-full">
                {subqueries.map((sq, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 px-2.5 py-2 bg-[var(--bg-muted)] rounded-md"
                  >
                    <Badge variant="outline" size="xs" className="font-mono">
                      #{i + 1}
                    </Badge>
                    <span className="text-[13px] flex-1 text-[var(--fg-default)]">
                      {sq.query}
                    </span>
                    {sq.foundChunks !== undefined && (
                      <Badge variant="info" size="xs">
                        {sq.foundChunks} frags
                      </Badge>
                    )}
                    {sq.status === "pending" && (
                      <Badge variant="subtle" size="xs">pendiente</Badge>
                    )}
                    {sq.status === "running" && (
                      <Badge variant="info" size="xs">
                        <Loader2 className="size-3 animate-spin" />
                        buscando…
                      </Badge>
                    )}
                    {sq.status === "done" && (
                      <Badge variant="success" size="xs">
                        <CheckCircle2 className="size-3" />
                      </Badge>
                    )}
                    {sq.status === "error" && (
                      <Badge variant="danger" size="xs">
                        <XCircle className="size-3" />
                        error
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(loadError || isError) && (
            <div
              role="alert"
              className="mb-4 p-4 rounded-lg border border-[var(--color-danger-fg)]/40 bg-[var(--color-danger-bg)] flex items-start gap-3"
            >
              <AlertCircle className="size-4 text-[var(--color-danger-fg)] mt-0.5 shrink-0" />
              <div className="flex-1 text-sm text-[var(--color-danger-fg)]">
                {loadError ?? data.metadata?.message ?? "Falló el procesamiento"}
              </div>
            </div>
          )}

          {(data.answer || isComplete) && (
            <Card variant="default" size="sm" className="p-0 overflow-hidden">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="px-4 pt-2 border-b border-[var(--border-default)]">
                  <TabsList variant="underline">
                    <TabsTrigger value="paper">
                      <BookOpen className="size-3.5" />
                      Paper
                    </TabsTrigger>
                    <TabsTrigger value="cronologia" disabled={!sections.cronologia}>
                      <Calendar className="size-3.5" />
                      Cronología
                    </TabsTrigger>
                    <TabsTrigger value="actores" disabled={!sections.actores}>
                      <Users className="size-3.5" />
                      Actores
                    </TabsTrigger>
                    <TabsTrigger value="vacios" disabled={!sections.vacios}>
                      <FileSearch className="size-3.5" />
                      Vacíos
                    </TabsTrigger>
                    <TabsTrigger
                      value="fuentes"
                      disabled={(data.chunksUsed?.length ?? 0) === 0}
                    >
                      <History className="size-3.5" />
                      Fuentes ({data.chunksUsed?.length ?? 0})
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="paper" className="mt-0">
                  <div className="px-8 py-5 pb-10">
                    {sections.paper ? (
                      <MarkdownWithCitations
                        text={sections.paper}
                        chunks={data.chunksUsed ?? []}
                      />
                    ) : (
                      <EmptyHint label="Aún no generado" />
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="cronologia" className="mt-0">
                  <div className="px-8 py-5 pb-10">
                    {sections.cronologia ? (
                      <MarkdownWithCitations
                        text={sections.cronologia}
                        chunks={data.chunksUsed ?? []}
                      />
                    ) : (
                      <EmptyHint label="Aún no generada" />
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="actores" className="mt-0">
                  <div className="px-8 py-5 pb-10">
                    {sections.actores ? (
                      <MarkdownWithCitations
                        text={sections.actores}
                        chunks={data.chunksUsed ?? []}
                      />
                    ) : (
                      <EmptyHint label="Aún no generada" />
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="vacios" className="mt-0">
                  <div className="px-8 py-5 pb-10">
                    {sections.vacios ? (
                      <MarkdownWithCitations
                        text={sections.vacios}
                        chunks={data.chunksUsed ?? []}
                      />
                    ) : (
                      <EmptyHint label="Aún no generada" />
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="fuentes" className="mt-0">
                  <div className="px-6 py-4 pb-10">
                    {(data.chunksUsed?.length ?? 0) > 0 ? (
                      <div className="flex flex-col gap-2 w-full">
                        {data.chunksUsed.map((c, i) => (
                          <Card
                            key={c.id ?? i}
                            variant="default"
                            size="sm"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="warning"
                                  size="xs"
                                  className="font-mono"
                                >
                                  #{i + 1}
                                </Badge>
                                <span className="text-[11px] text-[var(--fg-muted)]">
                                  p. {c.pageNumber}
                                  {c.similarity !== undefined &&
                                    ` · sim ${(c.similarity * 100).toFixed(0)}%`}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs font-semibold text-[var(--fg-default)] mb-1.5">
                              {c.documentFilename}
                            </div>
                            {c.content && (
                              <p
                                className="text-[13px] leading-relaxed text-[var(--fg-muted)] m-0 line-clamp-4"
                                style={{ fontFamily: "var(--font-serif)" }}
                              >
                                {c.content}
                              </p>
                            )}
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <EmptyHint label="Sin fuentes registradas" />
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          )}
        </>
      )}

      {!data && !submitting && (
        <Card variant="default" size="md">
          <EmptyHint label="Plantea una pregunta amplia de investigación para empezar" />
        </Card>
      )}
    </div>
  );
}

/* ─── Sub-componentes locales ───────────────────────────────────────────── */

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="py-8 text-center text-sm text-[var(--fg-subtle)]">
      {label}
    </div>
  );
}

interface StepItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

function Steps({
  current,
  status,
  items,
}: {
  current: number;
  status: "process" | "error";
  items: StepItem[];
}) {
  return (
    <ol className="flex items-start gap-2 w-full overflow-x-auto">
      {items.map((item, i) => {
        const isDone = i < current;
        const isActive = i === current;
        const isError = isActive && status === "error";
        const Icon = item.icon;

        const circleClass = cn(
          "size-7 rounded-full flex items-center justify-center shrink-0 border transition-colors",
          isError &&
            "bg-[var(--color-danger-bg)] border-[var(--color-danger-fg)] text-[var(--color-danger-fg)]",
          !isError && isDone &&
            "bg-[var(--accent)] border-[var(--accent)] text-[var(--fg-inverted)]",
          !isError && isActive &&
            "bg-[var(--accent-bg-subtle)] border-[var(--accent)] text-[var(--accent)]",
          !isError && !isDone && !isActive &&
            "bg-[var(--bg-muted)] border-[var(--border-default)] text-[var(--fg-subtle)]",
        );

        return (
          <li
            key={item.title}
            className="flex-1 min-w-[110px] flex flex-col items-start gap-1.5"
          >
            <div className="flex items-center gap-2 w-full">
              <div className={circleClass}>
                {isDone ? (
                  <CheckCircle2 className="size-3.5" />
                ) : isActive && status !== "error" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Icon className="size-3.5" />
                )}
              </div>
              {i < items.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 transition-colors",
                    isDone
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--border-default)]",
                  )}
                />
              )}
            </div>
            <span
              className={cn(
                "text-[11px] leading-tight",
                isActive
                  ? "text-[var(--fg-default)] font-medium"
                  : "text-[var(--fg-subtle)]",
              )}
            >
              {item.title}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Parsea el `answer` (markdown completo) y separa por secciones para los tabs.
 *
 * El backend de deep-research compone:
 *   [paper-academico, con # Título + ## El problema ... ## Conclusión]
 *   ---
 *   ## Cronología (tabla)
 *   ---
 *   ## Actores principales (tabla)
 *   ---
 *   ## Lo que el corpus no responde (lista)
 *   ---
 *   ## Referencias (APA)
 */
function parseSections(text: string): {
  paper: string;
  cronologia: string;
  actores: string;
  vacios: string;
  referencias: string;
} {
  if (!text) return { paper: "", cronologia: "", actores: "", vacios: "", referencias: "" };

  const markers: Array<{ name: keyof ReturnType<typeof parseSections>; regex: RegExp }> = [
    { name: "cronologia", regex: /^##\s+Cronolog[íi]a\s*$/m },
    { name: "actores", regex: /^##\s+Actores\s+principales\s*$/m },
    { name: "vacios", regex: /^##\s+Lo\s+que\s+el\s+corpus\s+no\s+responde\s*$/m },
    { name: "referencias", regex: /^##\s+Referencias\s*$/m },
  ];

  const positions: Array<{ name: string; start: number }> = [];
  for (const m of markers) {
    const match = m.regex.exec(text);
    if (match) positions.push({ name: m.name, start: match.index });
  }
  positions.sort((a, b) => a.start - b.start);

  const sections = { paper: "", cronologia: "", actores: "", vacios: "", referencias: "" };

  if (positions.length === 0) {
    sections.paper = text;
    return sections;
  }

  sections.paper = stripTrailingSeparator(text.slice(0, positions[0].start));
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].start;
    const end = i + 1 < positions.length ? positions[i + 1].start : text.length;
    sections[positions[i].name as keyof typeof sections] = stripTrailingSeparator(text.slice(start, end));
  }
  return sections;
}

function stripTrailingSeparator(s: string): string {
  return s.replace(/\n*-{3,}\s*$/g, "").trim();
}

/**
 * Renderiza markdown sustituyendo [#N] por un Popover con hover que muestra
 * documento, página y snippet del chunk citado.
 */
function MarkdownWithCitations({
  text,
  chunks,
}: {
  text: string;
  chunks: ChunkMeta[];
}) {
  const prepared = text.replace(/\[#(\d+(?:\s*,\s*\d+)*)\]/g, (_m, nums) => {
    const list = String(nums)
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    return list.map((n) => `\`#${n}\``).join(" ");
  });

  return (
    <div className="prose-academic">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ children, ...props }) {
            const txt = String(children).replace(/`/g, "");
            const m = /^#(\d+)$/.exec(txt);
            if (m) {
              const idx = parseInt(m[1], 10) - 1;
              const chunk = chunks[idx];
              if (!chunk) {
                return <code {...props}>{children}</code>;
              }
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <span
                      className={cn(
                        "citation inline-flex items-center align-baseline",
                        "font-mono text-[0.8em] font-medium",
                        "px-1.5 py-0 rounded-sm cursor-help whitespace-nowrap",
                        "bg-[color-mix(in_oklab,var(--color-warning-fg)_12%,transparent)]",
                        "text-[var(--color-warning-fg)]",
                        "border border-[color-mix(in_oklab,var(--color-warning-fg)_25%,transparent)]",
                        "hover:bg-[color-mix(in_oklab,var(--color-warning-fg)_20%,transparent)]",
                      )}
                    >
                      #{m[1]}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent align="center" className="max-w-[360px]">
                    <div className="text-xs font-semibold text-[var(--fg-default)] mb-1">
                      {chunk.documentFilename ?? "Documento sin nombre"}
                    </div>
                    <div className="text-[11px] text-[var(--fg-muted)]">
                      p. {chunk.pageNumber}
                      {chunk.similarity !== undefined &&
                        ` · sim ${(chunk.similarity * 100).toFixed(0)}%`}
                    </div>
                    {chunk.content && (
                      <>
                        <Separator className="my-2" />
                        <p
                          className="text-[12.5px] leading-snug m-0 text-[var(--fg-muted)]"
                          style={{ fontFamily: "var(--font-serif)" }}
                        >
                          {chunk.content}
                        </p>
                      </>
                    )}
                  </PopoverContent>
                </Popover>
              );
            }
            return <code {...props}>{children}</code>;
          },
        }}
      >
        {prepared}
      </ReactMarkdown>
    </div>
  );
}
