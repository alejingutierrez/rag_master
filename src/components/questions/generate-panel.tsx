"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, RefreshCw, CheckCircle2, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface DocumentWithQuestions {
  id: string;
  filename: string;
  status: string;
  _count: { chunks: number; questions: number };
  latestBatch?: string | null;
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
}

export function GeneratePanel() {
  const [documents, setDocuments] = useState<DocumentWithQuestions[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressStep[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes] = await Promise.all([
        fetch("/api/documents?limit=100&status=READY"),
      ]);
      const docsData = await docsRes.json();
      const docs: DocumentWithQuestions[] = docsData.documents ?? [];

      // Cargar conteo de preguntas por documento
      const enriched = await Promise.all(
        docs.map(async (doc) => {
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
        })
      );

      setDocuments(enriched);
    } catch (err) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const selectedDocument = documents.find((d) => d.id === selectedDoc);
  const hasQuestions = (selectedDocument?._count.questions ?? 0) > 0;

  const handleGenerate = async () => {
    if (!selectedDoc) return;

    const confirmMsg = hasQuestions
      ? `¿Regenerar las ${selectedDocument?._count.questions} preguntas de "${selectedDocument?.filename}"? Las preguntas actuales serán eliminadas.`
      : null;

    if (confirmMsg && !window.confirm(confirmMsg)) return;

    setGenerating(true);
    setProgress([]);
    setGeneratedQuestions([]);
    setError(null);
    setDone(false);

    const steps = [
      { step: "fetching_chunks", message: "Obteniendo chunks del documento..." },
      { step: "selecting_chunks", message: "Seleccionando fragmentos representativos..." },
      { step: "calling_claude", message: "Llamando a Claude Opus..." },
      { step: "parsing", message: "Procesando respuesta..." },
    ];

    try {
      const response = await fetch(
        `/api/documents/${selectedDoc}/questions/generate`,
        { method: "POST" }
      );

      if (!response.body) throw new Error("No stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "progress") {
              setProgress((prev) => {
                const existing = prev.find((s) => s.step === event.step);
                if (existing) return prev.map((s) => s.step === event.step ? { ...s, done: true } : s);
                const stepDef = steps.find((s) => s.step === event.step);
                return [...prev.map((s) => ({ ...s, done: true })), {
                  step: event.step,
                  message: stepDef?.message ?? event.message,
                  done: false,
                }];
              });
            }

            if (event.type === "question") {
              setProgress((prev) => prev.map((s) => ({ ...s, done: true })));
              setGeneratedQuestions((prev) => [
                ...prev,
                {
                  index: event.index,
                  pregunta: event.question.pregunta,
                  periodoNombre: event.question.periodoNombre,
                  categoriaNombre: event.question.categoriaNombre,
                },
              ]);
            }

            if (event.type === "complete") {
              setProgress((prev) => prev.map((s) => ({ ...s, done: true })));
              setDone(true);
              loadDocuments();
            }

            if (event.type === "error") {
              setError(event.message);
            }
          } catch {/* skip malformed events */}
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  const readyDocs = documents.filter((d) => d.status === "READY");
  const withQuestions = documents.filter((d) => d._count.questions > 0).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{readyDocs.length}</p>
          <p className="text-xs text-neutral-400 mt-1">Documentos disponibles</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{withQuestions}</p>
          <p className="text-xs text-neutral-400 mt-1">Con preguntas generadas</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-neutral-400">{readyDocs.length - withQuestions}</p>
          <p className="text-xs text-neutral-400 mt-1">Pendientes</p>
        </div>
      </div>

      {/* Selector de documento */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-neutral-300 mb-3">Seleccionar documento</h2>
        <select
          value={selectedDoc}
          onChange={(e) => {
            setSelectedDoc(e.target.value);
            setProgress([]);
            setGeneratedQuestions([]);
            setError(null);
            setDone(false);
          }}
          className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-neutral-500"
        >
          <option value="">— Selecciona un documento —</option>
          {readyDocs.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc._count.questions > 0 ? "✓ " : "○ "}
              {doc.filename.length > 60 ? doc.filename.slice(0, 60) + "..." : doc.filename}
              {doc._count.questions > 0 ? ` (${doc._count.questions} preguntas)` : ""}
            </option>
          ))}
        </select>

        {/* Estado del documento seleccionado */}
        {selectedDocument && (
          <div className="mt-4 p-4 bg-neutral-800 rounded-lg border border-neutral-700">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-neutral-400">
                  <span className="font-medium text-neutral-300">{selectedDocument._count.chunks}</span> chunks disponibles
                </p>
                {hasQuestions ? (
                  <p className="text-xs text-emerald-400 mt-1">
                    ✓ {selectedDocument._count.questions} preguntas ya generadas
                    {selectedDocument.latestDate && (
                      <span className="text-neutral-500 ml-2">
                        · {new Date(selectedDocument.latestDate).toLocaleDateString("es-CO")}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500 mt-1">Sin preguntas generadas</p>
                )}
              </div>
              {hasQuestions && (
                <Link
                  href={`/questions?documentId=${selectedDocument.id}`}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
                >
                  Ver preguntas <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            {/* Botón de generar */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={cn(
                "mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                generating
                  ? "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                  : hasQuestions
                  ? "bg-neutral-700 hover:bg-neutral-600 text-white border border-neutral-600"
                  : "bg-white text-black hover:bg-neutral-200"
              )}
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generando preguntas...</>
              ) : hasQuestions ? (
                <><RefreshCw className="h-4 w-4" /> Regenerar preguntas</>
              ) : (
                <><BookOpen className="h-4 w-4" /> Generar 10 preguntas</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Panel de progreso */}
      {(progress.length > 0 || generating) && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-neutral-300 mb-4">Progreso</h3>
          <div className="space-y-2">
            {progress.map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400 flex-shrink-0" />
                )}
                <span className={step.done ? "text-neutral-400" : "text-white"}>
                  {step.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-800 rounded-xl text-sm text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Preview de preguntas generadas */}
      {generatedQuestions.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-300">
              {done ? `✓ ${generatedQuestions.length} preguntas generadas` : `Generando... ${generatedQuestions.length}/10`}
            </h3>
            {done && (
              <Link
                href={selectedDoc ? `/questions?documentId=${selectedDoc}` : "/questions"}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                Ver todas <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <div className="space-y-2">
            {generatedQuestions.map((q) => (
              <div key={q.index} className="flex gap-3 p-3 bg-neutral-800 rounded-lg">
                <span className="text-neutral-500 font-mono text-xs min-w-[1.5rem]">
                  {q.index}.
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white leading-relaxed line-clamp-2">{q.pregunta}</p>
                  <div className="flex gap-2 mt-1.5">
                    <span className="text-xs text-neutral-500">{q.periodoNombre}</span>
                    <span className="text-neutral-700">·</span>
                    <span className="text-xs text-neutral-500">{q.categoriaNombre}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
