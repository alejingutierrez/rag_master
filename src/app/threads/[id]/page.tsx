"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  BookOpen,
  LayoutGrid,
  Edit3,
  Trash2,
  ArrowRight,
} from "lucide-react";
import {
  Button,
  IconButton,
  Input,
  Textarea,
  FieldLabel,
  FieldHelp,
  Card,
  CardBody,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui";
import { cn } from "@/lib/cn";

import { safeGet, safeSet, uid } from "@/lib/safe-storage";

interface Step {
  id: string;
  type: "question" | "production" | "note";
  refId?: string;
  text?: string;
  templateId?: string;
}

interface Thread {
  id: string;
  title: string;
  description?: string;
  steps: Step[];
  createdAt: string;
}

const STORAGE_KEY = "rag-master-threads";

function loadThreads(): Thread[] {
  return safeGet<Thread[]>(STORAGE_KEY, []);
}

function saveThreads(t: Thread[]) {
  return safeSet(STORAGE_KEY, t);
}

type StepType = "question" | "production" | "note";

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [thread, setThread] = useState<Thread | null>(null);
  const [questions, setQuestions] = useState<Array<{ id: string; pregunta: string }>>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [stepType, setStepType] = useState<StepType>("note");
  const [refId, setRefId] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [errors, setErrors] = useState<{ refId?: boolean; text?: boolean }>({});

  useEffect(() => {
    const all = loadThreads();
    const t = all.find((x) => x.id === id) ?? null;
    setThread(t);
  }, [id]);

  useEffect(() => {
    fetch("/api/questions?limit=200")
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions ?? []))
      .catch(console.error);
  }, []);

  if (!thread) {
    return (
      <div className="max-w-[var(--container-reading)] mx-auto px-8 py-8">
        <Card variant="default" size="md">
          <div className="py-10 text-center">
            <div className="text-[15px] font-medium text-[var(--fg-default)] mb-1">
              Hilo no encontrado
            </div>
            <div className="text-[13px] text-[var(--fg-subtle)] mb-4">
              El hilo solicitado no existe o fue eliminado.
            </div>
            <Link href="/threads">
              <Button variant="secondary" leadingIcon={<ArrowLeft className="size-4" />}>
                Volver a hilos
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const persist = (newSteps: Step[]) => {
    const updated = { ...thread, steps: newSteps };
    setThread(updated);
    const all = loadThreads().map((t) => (t.id === id ? updated : t));
    saveThreads(all);
  };

  const resetForm = () => {
    setStepType("note");
    setRefId("");
    setText("");
    setErrors({});
  };

  const handleAdd = () => {
    const nextErrors: { refId?: boolean; text?: boolean } = {};
    if ((stepType === "question" || stepType === "production") && !refId.trim()) {
      nextErrors.refId = true;
    }
    if (stepType === "note" && !text.trim()) {
      nextErrors.text = true;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const step: Step = {
      id: uid("st"),
      type: stepType,
      refId: stepType !== "note" ? refId.trim() : undefined,
      text: stepType === "note" ? text.trim() : undefined,
    };
    persist([...thread.steps, step]);
    toast.success("Paso añadido");
    setShowAdd(false);
    resetForm();
  };

  const removeStep = (stepId: string) => {
    persist(thread.steps.filter((s) => s.id !== stepId));
  };

  return (
    <div className="max-w-[var(--container-reading)] mx-auto px-8 py-8">
      <Link href="/threads" className="inline-block mb-3">
        <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft className="size-4" />}>
          Volver a hilos
        </Button>
      </Link>

      <h1
        className="serif-title text-[36px] leading-tight m-0 text-[var(--color-ink-1000)]"
        style={{ fontWeight: 700 }}
      >
        {thread.title}
      </h1>
      {thread.description && (
        <p className="text-[15px] leading-relaxed text-[var(--fg-muted)] mt-2 mb-0 max-w-[720px]">
          {thread.description}
        </p>
      )}

      <div className="my-6 flex justify-end">
        <Button
          variant="primary"
          leadingIcon={<Plus className="size-4" />}
          onClick={() => setShowAdd(true)}
        >
          Añadir paso
        </Button>
      </div>

      <Card variant="default" size="md">
        {thread.steps.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-[14px] text-[var(--fg-subtle)]">
              Hilo vacío — añade preguntas, producciones o notas
            </div>
          </div>
        ) : (
          <ol className="relative">
            {thread.steps.map((s, idx) => {
              const q = questions.find((qq) => qq.id === s.refId);
              const isLast = idx === thread.steps.length - 1;
              const dotConfig = stepDotConfig(s.type);
              return (
                <li key={s.id} className="relative pl-9 pb-5 last:pb-0">
                  {/* línea vertical */}
                  {!isLast && (
                    <span
                      aria-hidden
                      className="absolute left-3 top-7 bottom-0 w-px bg-[var(--border-default)]"
                    />
                  )}
                  {/* dot */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1 size-6 rounded-full inline-flex items-center justify-center",
                      "bg-[var(--bg-page)] border-2",
                      dotConfig.borderClass,
                    )}
                  >
                    <dotConfig.Icon className={cn("size-3.5", dotConfig.iconClass)} />
                  </span>

                  <Card variant="outline" size="sm" className="!p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={dotConfig.badgeVariant} size="xs">
                        {s.type}
                      </Badge>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        aria-label="Eliminar paso"
                        onClick={() => removeStep(s.id)}
                        className="text-[var(--color-danger-fg)]"
                      >
                        <Trash2 className="size-3.5" />
                      </IconButton>
                    </div>

                    {s.type === "question" && q && (
                      <div className="mt-2">
                        <p className="text-[14px] leading-snug text-[var(--fg-default)] serif-title">
                          {q.pregunta}
                        </p>
                        <div className="mt-1.5">
                          <Link href={`/questions?focus=${q.id}`}>
                            <Button
                              variant="link"
                              size="sm"
                              trailingIcon={<ArrowRight className="size-3" />}
                            >
                              Ver pregunta
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}

                    {s.type === "production" && s.refId && (
                      <div className="mt-2">
                        <Link href={`/producciones/${s.refId}`}>
                          <Button
                            variant="link"
                            size="sm"
                            trailingIcon={<ArrowRight className="size-3" />}
                          >
                            Ver producción
                          </Button>
                        </Link>
                      </div>
                    )}

                    {s.type === "note" && s.text && (
                      <div className="prose-academic mt-2 text-[14px]">
                        <ReactMarkdown>{s.text}</ReactMarkdown>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {/* Dialog: añadir paso */}
      <Dialog
        open={showAdd}
        onOpenChange={(open) => {
          setShowAdd(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Añadir paso al hilo</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <FieldLabel required>Tipo</FieldLabel>
              <RadioGroup
                value={stepType}
                onValueChange={(v) => {
                  setStepType(v as StepType);
                  setErrors({});
                  setRefId("");
                  setText("");
                }}
                className="gap-2"
              >
                <StepTypeOption
                  value="question"
                  checked={stepType === "question"}
                  label="Pregunta del corpus"
                />
                <StepTypeOption
                  value="production"
                  checked={stepType === "production"}
                  label="ID de producción"
                />
                <StepTypeOption
                  value="note"
                  checked={stepType === "note"}
                  label="Nota libre (Markdown)"
                />
              </RadioGroup>
            </div>

            {stepType === "question" && (
              <div>
                <FieldLabel required htmlFor="step-question">
                  Pregunta
                </FieldLabel>
                <select
                  id="step-question"
                  value={refId}
                  onChange={(e) => {
                    setRefId(e.target.value);
                    if (errors.refId) setErrors({ ...errors, refId: false });
                  }}
                  className={cn(
                    "w-full h-9 px-3 text-sm rounded-md bg-[var(--bg-page)] text-[var(--fg-default)]",
                    "border transition-colors duration-[var(--duration-fast)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]",
                    errors.refId
                      ? "border-[var(--color-danger-fg)]"
                      : "border-[var(--border-default)] hover:border-[var(--border-strong)] focus-visible:border-[var(--color-tinta-500)]",
                  )}
                >
                  <option value="">Selecciona una pregunta…</option>
                  {questions.slice(0, 200).map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.pregunta.slice(0, 80)}
                    </option>
                  ))}
                </select>
                {errors.refId && <FieldHelp error>Selecciona una pregunta.</FieldHelp>}
              </div>
            )}

            {stepType === "production" && (
              <div>
                <FieldLabel required htmlFor="step-prod">
                  ID de producción
                </FieldLabel>
                <Input
                  id="step-prod"
                  value={refId}
                  error={errors.refId}
                  placeholder="ID de producción"
                  onChange={(e) => {
                    setRefId(e.target.value);
                    if (errors.refId) setErrors({ ...errors, refId: false });
                  }}
                />
                {errors.refId && <FieldHelp error>Ingresa un ID.</FieldHelp>}
              </div>
            )}

            {stepType === "note" && (
              <div>
                <FieldLabel required htmlFor="step-text">
                  Texto (Markdown)
                </FieldLabel>
                <Textarea
                  id="step-text"
                  rows={5}
                  value={text}
                  error={errors.text}
                  placeholder="Escribe tu nota en Markdown…"
                  onChange={(e) => {
                    setText(e.target.value);
                    if (errors.text) setErrors({ ...errors, text: false });
                  }}
                />
                {errors.text && <FieldHelp error>Ingresa el texto de la nota.</FieldHelp>}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button variant="primary" onClick={handleAdd}>
              Añadir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function stepDotConfig(type: StepType) {
  if (type === "question") {
    return {
      Icon: BookOpen,
      borderClass: "border-[var(--color-warning-fg)]",
      iconClass: "text-[var(--color-warning-fg)]",
      badgeVariant: "warning" as const,
    };
  }
  if (type === "production") {
    return {
      Icon: LayoutGrid,
      borderClass: "border-[var(--color-category-cul)]",
      iconClass: "text-[var(--color-category-cul)]",
      badgeVariant: "tinta" as const,
    };
  }
  return {
    Icon: Edit3,
    borderClass: "border-[var(--accent)]",
    iconClass: "text-[var(--accent)]",
    badgeVariant: "info" as const,
  };
}

function StepTypeOption({
  value,
  checked,
  label,
}: {
  value: string;
  checked: boolean;
  label: string;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer",
        "border transition-colors duration-[var(--duration-fast)]",
        checked
          ? "border-[var(--accent)] bg-[var(--accent-bg-subtle)]"
          : "border-[var(--border-default)] hover:border-[var(--border-strong)]",
      )}
    >
      <RadioGroupItem value={value} />
      <span className="text-[13.5px] text-[var(--fg-default)]">{label}</span>
    </label>
  );
}
