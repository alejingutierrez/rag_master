"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { primaryBtn, ghostBtn, PeriodTag } from "@/components/editorial";
import { Cita } from "@/components/editorial/cita";
import { TIPO_LABELS, ESCALA_LABELS } from "@/lib/questions-config";
import type { TipoPregunta, EscalaGeografica } from "@/lib/questions-config";
import { CHAT_TEMPLATES, DEFAULT_TEMPLATE_ID } from "@/lib/chat-templates";

interface ChunkCitation {
  id: string;
  documentId: string;
  documentFilename?: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  content: string;
}

// Contexto analítico viajado desde /questions (drawer "Abrir en chat").
// Se muestra como badges en el header y se envía al API para enriquecer el prompt.
interface QuestionContext {
  id?: string;
  periodoCode?: string;
  periodoNombre?: string;
  periodoRango?: string;
  categoriaCode?: string;
  categoriaNombre?: string;
  subcategoriaCode?: string;
  subcategoriaNombre?: string;
  tipoPregunta?: string;
  escalaGeografica?: string;
  clusterTematico?: string;
  hipotesisImplicita?: string;
  justificacion?: string;
  yearPrincipal?: number | null;
  yearsSecondary?: number[];
  entidadesPersonas?: string[];
  entidadesLugares?: string[];
  entidadesConceptos?: string[];
}

type Phase = "intro" | "searching" | "streaming" | "done" | "error";

const STARTERS = [
  "¿Cómo evolucionó el modelo bipartidista durante la Regeneración?",
  "¿Qué impacto tuvieron las reformas de López Pumarejo en la sociedad?",
  "Compara el rol de la Iglesia en el XIX colombiano con su papel actual.",
  "Explica las causas estructurales de la Guerra de los Mil Días.",
];

const RAG_CONFIG = { topK: 100, similarityThreshold: 0.25 };

function citationDocLabel(c: ChunkCitation): string {
  if (c.documentFilename) {
    return c.documentFilename.replace(/\.pdf$/i, "");
  }
  return c.documentId.slice(0, 8);
}

export default function ChatPage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [question, setQuestion] = useState("");
  const [askedQ, setAskedQ] = useState("");
  const [askedContext, setAskedContext] = useState<QuestionContext | null>(null);
  const [chunks, setChunks] = useState<ChunkCitation[]>([]);
  const [revealedChunks, setRevealedChunks] = useState(0);
  const [openChunk, setOpenChunk] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE_ID);

  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const typeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    };
  }, []);

  const handleAsk = useCallback(async (q: string, context?: QuestionContext, tplId?: string) => {
    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (typeTimerRef.current) clearInterval(typeTimerRef.current);

    setAskedQ(q);
    setAskedContext(context ?? null);
    setQuestion("");
    setPhase("searching");
    setChunks([]);
    setRevealedChunks(0);
    setOpenChunk(null);
    setStreamingText("");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          topK: RAG_CONFIG.topK,
          similarityThreshold: RAG_CONFIG.similarityThreshold,
          ...(context ? { questionContext: context } : {}),
          ...(tplId ? { templateId: tplId } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPhase("error");
        setErrorMessage((err as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }

      const { id } = (await res.json()) as { id: string };

      // Polling. El POST ya no devuelve chunks: el pipeline corre en background
      // y los publica vía polling.
      //   status="RETRIEVING" → aún buscando, mantener spinner.
      //   status="GENERATING" → chunks listos, animar reveal mientras Claude redacta.
      //   status="COMPLETE"   → arrancar typing del answer.
      //   status="ERROR"      → mostrar mensaje.
      let chunksRevealStarted = false;
      let visibleChunks: ChunkCitation[] = [];

      pollTimerRef.current = setInterval(async () => {
        try {
          const poll = await fetch(`/api/chat/${id}`);
          if (!poll.ok) return;
          const data = (await poll.json()) as {
            status: string;
            answer?: string;
            chunks?: ChunkCitation[];
          };

          // Arrancar reveal de chunks la primera vez que llegan.
          // Mostramos todos los chunks que persistió el backend (hasta 50);
          // así el panel "Fuentes" refleja exactamente lo que vio el LLM.
          if (!chunksRevealStarted && data.chunks && data.chunks.length > 0) {
            chunksRevealStarted = true;
            visibleChunks = data.chunks;
            setChunks(visibleChunks);
            // Reveal escalonado pero rápido: ~3-4s total para 50 cards.
            const intervalMs = visibleChunks.length > 10 ? 80 : 200;
            let r = 0;
            revealTimerRef.current = setInterval(() => {
              r++;
              setRevealedChunks(Math.min(r, visibleChunks.length));
              if (r >= visibleChunks.length && revealTimerRef.current) {
                clearInterval(revealTimerRef.current);
                revealTimerRef.current = null;
              }
            }, intervalMs);
          }

          if (data.status === "COMPLETE" && data.answer) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            if (revealTimerRef.current) {
              clearInterval(revealTimerRef.current);
              revealTimerRef.current = null;
            }
            setRevealedChunks(visibleChunks.length);
            startTyping(data.answer);
          } else if (data.status === "ERROR") {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setPhase("error");
            setErrorMessage(data.answer ?? "Error al generar respuesta.");
          }
        } catch {
          /* retry next tick */
        }
      }, 2000);
    } catch (err) {
      console.error(err);
      setPhase("error");
      setErrorMessage("Error de conexión.");
    }
  }, []);

  function startTyping(full: string) {
    setPhase("streaming");
    let i = 0;
    typeTimerRef.current = setInterval(() => {
      i = Math.min(i + 30, full.length);
      setStreamingText(full.slice(0, i));
      if (i >= full.length && typeTimerRef.current) {
        clearInterval(typeTimerRef.current);
        typeTimerRef.current = null;
        setPhase("done");
      }
    }, 22);
  }

  const submit = () => {
    const q = question.trim();
    if (!q || phase === "searching" || phase === "streaming") return;
    void handleAsk(q, undefined, templateId);
  };

  // Deep-link desde /questions (drawer "Abrir en chat"):
  //   /chat?q=texto              → autodispara con question text
  //   /chat?questionId=ID        → fetch metadata + autodispara con contexto
  //   /chat?questionId=ID&q=...  → ambos (questionId tiene prioridad para contexto)
  // URL se lee solo una vez en mount; refrescos posteriores no re-disparan.
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get("q");
    const idParam = params.get("questionId");
    if (!qParam && !idParam) return;
    autoFiredRef.current = true;

    (async () => {
      let context: QuestionContext | undefined;
      let questionText = qParam ?? "";

      if (idParam) {
        try {
          const r = await fetch(`/api/questions/${idParam}`);
          if (r.ok) {
            const data = (await r.json()) as { question?: QuestionContext & { pregunta?: string } };
            const q = data.question;
            if (q) {
              if (q.pregunta && !questionText) questionText = q.pregunta;
              context = {
                id: q.id,
                periodoCode: q.periodoCode,
                periodoNombre: q.periodoNombre,
                periodoRango: q.periodoRango,
                categoriaCode: q.categoriaCode,
                categoriaNombre: q.categoriaNombre,
                subcategoriaCode: q.subcategoriaCode,
                subcategoriaNombre: q.subcategoriaNombre,
                tipoPregunta: q.tipoPregunta,
                escalaGeografica: q.escalaGeografica,
                clusterTematico: q.clusterTematico,
                hipotesisImplicita: q.hipotesisImplicita,
                justificacion: q.justificacion,
                yearPrincipal: q.yearPrincipal,
                yearsSecondary: q.yearsSecondary,
                entidadesPersonas: q.entidadesPersonas,
                entidadesLugares: q.entidadesLugares,
                entidadesConceptos: q.entidadesConceptos,
              };
            }
          }
        } catch {
          // Si falla el fetch de metadata, seguimos solo con el texto crudo.
        }
      }

      if (!questionText) return;
      void handleAsk(questionText, context);
    })();
  }, [handleAsk]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const visibleAnswer = streamingText;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        minHeight: "calc(100vh - 61px)",
      }}
      data-screen-label="Chat"
    >
      {/* Main column */}
      <div
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: 1,
            padding: "56px 64px 24px",
            maxWidth: 860,
            margin: "0 auto",
            width: "100%",
          }}
        >
          {phase === "intro" ? (
            <ChatIntro onAsk={handleAsk} />
          ) : (
            <ChatConversation
              question={askedQ}
              context={askedContext}
              phase={phase}
              streamingText={visibleAnswer}
              revealedChunks={revealedChunks}
              totalChunks={chunks.length}
              onOpenChunk={setOpenChunk}
              chunks={chunks}
              errorMessage={errorMessage}
            />
          )}
        </div>

        {/* Input bar */}
        <div
          style={{
            padding: "16px 64px 24px",
            borderTop: "1px solid var(--line)",
            background: "var(--bg)",
            position: "sticky",
            bottom: 0,
          }}
        >
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <ChatInput
              value={question}
              onChange={setQuestion}
              onSubmit={submit}
              onKeyDown={handleKeyDown}
              disabled={phase === "searching" || phase === "streaming"}
              templateId={templateId}
              onTemplateChange={setTemplateId}
            />
          </div>
        </div>
      </div>

      {/* Right rail — Fuentes */}
      <aside
        style={{
          borderLeft: "1px solid var(--line)",
          background: "var(--bg)",
          overflowY: "auto",
          padding: "56px 32px 32px",
        }}
        aria-label="Fuentes citadas"
      >
        <div className="label" style={{ marginBottom: 8 }}>
          Fuentes
        </div>
        <h3
          className="display"
          style={{
            fontSize: 24,
            margin: "0 0 4px",
            color: "var(--fg)",
            lineHeight: 1.1,
          }}
        >
          {phase === "intro"
            ? "—"
            : phase === "searching"
              ? "Recuperando…"
              : `${revealedChunks} pasajes`}
        </h3>
        <p
          style={{
            fontSize: 12,
            color: "var(--fg-muted)",
            margin: "0 0 28px",
            lineHeight: 1.5,
          }}
        >
          {phase === "intro"
            ? "Los pasajes vectoriales que respaldan cada respuesta aparecerán aquí, con número de página y obra."
            : "Pasajes con similaridad > 0.25, rerankeados por relevancia."}
        </p>

        {phase !== "intro" &&
          chunks.slice(0, revealedChunks).map((c, idx) => (
            <ChunkCard
              key={c.id}
              chunk={c}
              n={idx + 1}
              open={openChunk === idx + 1}
              onToggle={() => setOpenChunk(openChunk === idx + 1 ? null : idx + 1)}
            />
          ))}

        {phase === "searching" && revealedChunks < chunks.length && (
          <div style={{ marginTop: 12 }}>
            {[0, 1].map((i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div className="shimmer-line" style={{ height: 12, width: "60%", marginBottom: 6 }} />
                <div className="shimmer-line" style={{ height: 10, width: "40%" }} />
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function ChatIntro({ onAsk }: { onAsk: (q: string) => void }) {
  return (
    <div className="fade-up" style={{ paddingTop: 40 }}>
      <div className="label" style={{ marginBottom: 18 }}>
        Consultar
      </div>
      <h1
        className="display"
        style={{
          fontSize: 80,
          margin: 0,
          color: "var(--fg)",
          lineHeight: 1.0,
          maxWidth: 720,
        }}
      >
        ¿Qué quiere preguntarle{" "}
        <span className="display-italic" style={{ color: "var(--fg-muted)" }}>
          al corpus?
        </span>
      </h1>
      <p
        className="serif"
        style={{
          fontSize: 19,
          color: "var(--fg-muted)",
          margin: "32px 0 56px",
          maxWidth: 600,
          lineHeight: 1.5,
        }}
      >
        Cada respuesta se construye sobre pasajes específicos de obras vectorizadas.
        Las citas inline abren el fragmento original con su número de página.
      </p>

      <div className="label" style={{ marginBottom: 14 }}>
        Inicios sugeridos
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {STARTERS.map((s, i) => (
          <li key={i} style={{ borderTop: "1px solid var(--line)" }}>
            <button
              type="button"
              onClick={() => onAsk(s)}
              style={{
                width: "100%",
                appearance: "none",
                background: "transparent",
                border: 0,
                padding: "18px 0",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontSize: 20,
                color: "var(--fg)",
                lineHeight: 1.3,
                letterSpacing: "-0.005em",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 18,
                transition: "color 140ms var(--ease-out-custom)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent)";
                const arrow = e.currentTarget.querySelector("[data-arrow]") as HTMLElement | null;
                if (arrow) {
                  arrow.style.transform = "translateX(4px)";
                  arrow.style.color = "var(--accent)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--fg)";
                const arrow = e.currentTarget.querySelector("[data-arrow]") as HTMLElement | null;
                if (arrow) {
                  arrow.style.transform = "translateX(0)";
                  arrow.style.color = "var(--fg-faint)";
                }
              }}
            >
              <span>{s}</span>
              <span
                data-arrow
                style={{
                  color: "var(--fg-faint)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 16,
                  transition: "all 140ms var(--ease-out-custom)",
                }}
              >
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChatConversation({
  question,
  context,
  phase,
  streamingText,
  revealedChunks,
  totalChunks,
  onOpenChunk,
  chunks,
  errorMessage,
}: {
  question: string;
  context: QuestionContext | null;
  phase: Phase;
  streamingText: string;
  revealedChunks: number;
  totalChunks: number;
  onOpenChunk: (n: number | null) => void;
  chunks: ChunkCitation[];
  errorMessage: string | null;
}) {
  const today = new Date().toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const tipoLabel = context?.tipoPregunta
    ? TIPO_LABELS[context.tipoPregunta as TipoPregunta] ?? context.tipoPregunta
    : null;
  const escalaLabel = context?.escalaGeografica
    ? ESCALA_LABELS[context.escalaGeografica as EscalaGeografica] ?? context.escalaGeografica
    : null;
  return (
    <div className="fade-up">
      <div style={{ marginBottom: 36 }}>
        <div className="label" style={{ marginBottom: 12 }}>
          {context?.id ? "Pregunta curada del corpus" : "Consulta"} · {today}
        </div>
        <h1
          className="display"
          style={{
            fontSize: 42,
            margin: 0,
            lineHeight: 1.15,
            color: "var(--fg)",
            letterSpacing: "-0.02em",
          }}
        >
          {question}
        </h1>
        {context && (tipoLabel || escalaLabel || context.periodoCode || context.clusterTematico) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18, alignItems: "center" }}>
            {context.periodoCode && <PeriodTag code={context.periodoCode} size="md" showName />}
            {tipoLabel && (
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  padding: "3px 8px",
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
            {escalaLabel && (
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  padding: "3px 8px",
                  border: "1px solid var(--fg)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderRadius: 3,
                }}
              >
                {escalaLabel}
              </span>
            )}
            {context.clusterTematico && (
              <span style={{ fontSize: 12.5, color: "var(--fg-muted)", fontStyle: "italic" }}>
                {context.clusterTematico}
              </span>
            )}
          </div>
        )}
      </div>

      <hr className="hairline" style={{ margin: "0 0 36px" }} />

      {phase === "searching" && (
        <div
          className="fade-in"
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0" }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent)",
              animation: "caret-blink 1s infinite",
            }}
          />
          <span style={{ fontSize: 14, color: "var(--fg-muted)" }}>
            Recuperando pasajes vectoriales… {revealedChunks}/{totalChunks || "…"}
          </span>
        </div>
      )}

      {phase === "error" && (
        <div
          className="fade-in"
          style={{
            padding: "16px 18px",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            fontSize: 14,
          }}
          role="alert"
        >
          {errorMessage ?? "Error al procesar la consulta."}
        </div>
      )}

      {(phase === "streaming" || phase === "done") && (
        <AnswerRender
          markdown={streamingText}
          streaming={phase === "streaming"}
          onOpenChunk={onOpenChunk}
          chunks={chunks}
        />
      )}

      {phase === "done" && (
        <div
          className="fade-in"
          style={{
            marginTop: 56,
            paddingTop: 24,
            borderTop: "1px solid var(--line)",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--fg-muted)",
              letterSpacing: "0.04em",
              marginBottom: 24,
            }}
          >
            Alejandro Gutiérrez · {today}
            {totalChunks > 0 ? ` · ${totalChunks} pasajes citados` : ""}
          </div>
          <div className="label" style={{ marginBottom: 16 }}>
            Siguiente
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button style={primaryBtn}>Convertir en producción →</button>
            <button style={ghostBtn}>Guardar en hilo</button>
            <button style={ghostBtn}>Profundizar</button>
            <button style={ghostBtn}>Copiar con citas</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AnswerRender({
  markdown,
  streaming,
  onOpenChunk,
  chunks,
}: {
  markdown: string;
  streaming: boolean;
  onOpenChunk: (n: number | null) => void;
  chunks: ChunkCitation[];
}) {
  // Render simple markdown: párrafos, listas, bold, italic, headings y citas inline [N].
  const lines = markdown.split("\n");
  return (
    <div className="prose" style={{ maxWidth: "none" }}>
      {lines.map((line, idx) => {
        const isLast = idx === lines.length - 1;
        if (line.startsWith("## ")) {
          return (
            <h2 key={idx}>
              {renderInline(line.slice(3), onOpenChunk, chunks)}
              {streaming && isLast && <span className="caret" />}
            </h2>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h1 key={idx}>
              {renderInline(line.slice(2), onOpenChunk, chunks)}
              {streaming && isLast && <span className="caret" />}
            </h1>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <li key={idx} style={{ marginLeft: 20, marginBottom: 10 }}>
              {renderInline(line.slice(2), onOpenChunk, chunks)}
              {streaming && isLast && <span className="caret" />}
            </li>
          );
        }
        if (line.trim() === "") {
          return <div key={idx} style={{ height: 6 }} />;
        }
        return (
          <p key={idx} style={{ margin: "0 0 1.1em" }}>
            {renderInline(line, onOpenChunk, chunks)}
            {streaming && isLast && <span className="caret" />}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(
  text: string,
  onOpenChunk: (n: number | null) => void,
  chunks: ChunkCitation[],
) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let i = 0;
  while (remaining.length) {
    const citaMatch = remaining.match(/^\[#?(\d+)\]/);
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (citaMatch) {
      const n = parseInt(citaMatch[1], 10);
      const chunk = chunks[n - 1];
      parts.push(
        <Cita
          key={i++}
          n={n}
          page={chunk?.pageNumber}
          doc={chunk ? citationDocLabel(chunk) : undefined}
          onClick={() => onOpenChunk(n)}
        />,
      );
      remaining = remaining.slice(citaMatch[0].length);
    } else if (boldMatch) {
      parts.push(
        <strong key={i++} style={{ fontWeight: 600 }}>
          {boldMatch[1]}
        </strong>,
      );
      remaining = remaining.slice(boldMatch[0].length);
    } else if (italicMatch) {
      parts.push(<em key={i++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
    } else {
      const nextCita = remaining.search(/\[#?\d+\]/);
      const nextBold = remaining.indexOf("**");
      const nextItalic = remaining.indexOf("*");
      const candidates = [nextCita, nextBold, nextItalic].filter((x) => x >= 0);
      const nextStop = candidates.length ? Math.min(...candidates) : remaining.length;
      const slice = remaining.slice(0, Math.max(nextStop, 1));
      parts.push(<Fragment key={i++}>{slice}</Fragment>);
      remaining = remaining.slice(slice.length);
    }
  }
  return parts;
}

function ChunkCard({
  chunk,
  n,
  open,
  onToggle,
}: {
  chunk: ChunkCitation;
  n: number;
  open: boolean;
  onToggle: () => void;
}) {
  const docLabel = citationDocLabel(chunk);
  return (
    <div
      className="fade-in"
      style={{
        marginBottom: 4,
        padding: "14px 0",
        borderTop: "1px solid var(--line)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          appearance: "none",
          background: "transparent",
          border: 0,
          width: "100%",
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
          display: "grid",
          gridTemplateColumns: "20px 1fr",
          gap: 12,
          alignItems: "baseline",
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 11.5,
            color: "var(--accent)",
            fontWeight: 500,
          }}
        >
          {String(n).padStart(2, "0")}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            className="serif"
            style={{
              fontSize: 14.5,
              color: "var(--fg)",
              lineHeight: 1.3,
              fontWeight: 500,
              letterSpacing: "-0.005em",
            }}
          >
            {docLabel}
          </div>
          <div
            className="mono"
            style={{ fontSize: 10.5, color: "var(--fg-subtle)", marginTop: 4 }}
          >
            p. {chunk.pageNumber} · sim {(chunk.similarity * 100).toFixed(0)}%
          </div>
        </div>
      </button>
      {open && (
        <div
          className="fade-in"
          style={{
            padding: "14px 0 4px 32px",
            fontStyle: "italic",
            fontFamily: "var(--font-display)",
            fontSize: 14,
            color: "var(--fg-muted)",
            lineHeight: 1.55,
          }}
        >
          “{chunk.content}”
        </div>
      )}
    </div>
  );
}

function ChatInput({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  disabled,
  templateId,
  onTemplateChange,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  templateId: string;
  onTemplateChange: (id: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const current = CHAT_TEMPLATES.find((t) => t.id === templateId) ?? CHAT_TEMPLATES[0];

  // Auto-resize: la caja crece con el texto hasta ~200px y luego hace scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 12,
        padding: "8px 0",
      }}
    >
      {/* Selector compacto de tipo de salida — el feature de múltiples plantillas. */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {pickerOpen && (
          <div
            onClick={() => setPickerOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 20 }}
            aria-hidden
          />
        )}
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          title={`Tipo de salida: ${current?.name ?? "—"}`}
          aria-label={`Tipo de salida: ${current?.name ?? "—"}`}
          style={{
            appearance: "none",
            background: "transparent",
            border: "1px solid var(--line-strong)",
            borderRadius: 6,
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            gap: 7,
            cursor: "pointer",
            color: "var(--fg-muted)",
            maxWidth: 170,
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>{current?.icon ?? "✶"}</span>
          <span
            className="mono"
            style={{
              fontSize: 11,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {current?.name ?? "Tipo"}
          </span>
          <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>▴</span>
        </button>
        {pickerOpen && (
          <div
            role="listbox"
            aria-label="Tipo de salida"
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: 0,
              zIndex: 21,
              width: 300,
              maxHeight: 340,
              overflowY: "auto",
              background: "var(--bg)",
              border: "1px solid var(--line-strong)",
              borderRadius: 8,
              boxShadow: "0 12px 40px -12px rgba(0,0,0,0.28)",
              padding: 6,
            }}
          >
            {CHAT_TEMPLATES.map((t) => {
              const active = t.id === templateId;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onTemplateChange(t.id);
                    setPickerOpen(false);
                  }}
                  style={{
                    appearance: "none",
                    background: active ? "var(--bg-muted)" : "transparent",
                    border: 0,
                    borderRadius: 6,
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 10px",
                    cursor: "pointer",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = active ? "var(--bg-muted)" : "transparent")
                  }
                >
                  <span style={{ fontSize: 16, lineHeight: 1.2 }}>{t.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        color: "var(--fg)",
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {t.name}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: "var(--fg-muted)",
                        lineHeight: 1.4,
                        marginTop: 2,
                      }}
                    >
                      {t.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Haga su consulta histórica…"
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          appearance: "none",
          background: "transparent",
          border: 0,
          outline: "none",
          resize: "none",
          fontFamily: "var(--font-display)",
          fontSize: 19,
          color: "var(--fg)",
          lineHeight: 1.45,
          padding: "6px 0",
          letterSpacing: "-0.005em",
          maxHeight: 200,
          overflowY: "auto",
        }}
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        style={{
          appearance: "none",
          background:
            value.trim() && !disabled ? "var(--fg)" : "var(--bg-muted)",
          color: value.trim() && !disabled ? "var(--bg)" : "var(--fg-faint)",
          border: 0,
          padding: "10px 18px",
          fontSize: 13.5,
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
          cursor: value.trim() && !disabled ? "pointer" : "default",
          whiteSpace: "nowrap",
        }}
      >
        {disabled ? "…" : "Consultar →"}
      </button>
    </form>
  );
}

