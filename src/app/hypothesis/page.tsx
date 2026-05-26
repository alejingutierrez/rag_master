"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader, primaryBtn } from "@/components/editorial";
import { Cita } from "@/components/editorial/cita";

interface ChunkCitation {
  id: string;
  documentId: string;
  documentFilename?: string;
  pageNumber: number;
  similarity: number;
  content: string;
}

interface SideResult {
  status: "idle" | "loading" | "complete" | "error";
  answer: string;
  citations: ChunkCitation[];
  streamPos?: number;
}

const FOR_PROMPT = (h: string) =>
  `Evalúa la siguiente hipótesis histórica y busca evidencia EN FAVOR. Cita pasajes específicos del corpus que la respalden, con razonamiento claro.\n\nHIPÓTESIS:\n"${h}"\n\nResponde con un mini-ensayo de evidencia favorable, argumentando por qué los hechos del corpus respaldan esta tesis. Incluye citas [#N] obligatorias.`;

const AGAINST_PROMPT = (h: string) =>
  `Evalúa la siguiente hipótesis histórica y busca evidencia EN CONTRA. Cita pasajes que la cuestionen, matizen o refuten, con razonamiento claro.\n\nHIPÓTESIS:\n"${h}"\n\nResponde con un mini-ensayo crítico que problematice esta tesis basándote en evidencia del corpus. Incluye citas [#N] obligatorias.`;

export default function HypothesisPage() {
  const [hypothesis, setHypothesis] = useState("");
  const [running, setRunning] = useState(false);
  const [forResult, setForResult] = useState<SideResult>({
    status: "idle",
    answer: "",
    citations: [],
  });
  const [againstResult, setAgainstResult] = useState<SideResult>({
    status: "idle",
    answer: "",
    citations: [],
  });

  const forPoller = useRef<ReturnType<typeof setInterval> | null>(null);
  const againstPoller = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (forPoller.current) clearInterval(forPoller.current);
      if (againstPoller.current) clearInterval(againstPoller.current);
    };
  }, []);

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
      });
      pollerRef.current = setInterval(async () => {
        const poll = await fetch(`/api/chat/${data.id}`);
        if (!poll.ok) return;
        const pd = await poll.json();
        if (pd.status === "COMPLETE") {
          if (pollerRef.current) clearInterval(pollerRef.current);
          pollerRef.current = null;
          setResult({
            status: "complete",
            answer: pd.answer,
            citations: data.chunks ?? [],
          });
        } else if (pd.status === "ERROR") {
          if (pollerRef.current) clearInterval(pollerRef.current);
          pollerRef.current = null;
          setResult({
            status: "error",
            answer: pd.answer || "Error",
            citations: [],
          });
        }
      }, 2000);
    } catch {
      setResult({ status: "error", answer: "Error de red", citations: [] });
    }
  };

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
      runSide(setForResult, forPoller, FOR_PROMPT(h)),
      runSide(setAgainstResult, againstPoller, AGAINST_PROMPT(h)),
    ]);

    const checkDone = setInterval(() => {
      if (!forPoller.current && !againstPoller.current) {
        clearInterval(checkDone);
        setRunning(false);
      }
    }, 1000);
  };

  const phase: "idle" | "running" | "done" =
    forResult.status === "idle" && againstResult.status === "idle"
      ? "idle"
      : running ||
          forResult.status === "loading" ||
          againstResult.status === "loading"
        ? "running"
        : "done";

  return (
    <div className="fade-up" data-screen-label="Hypothesis">
      <PageHeader
        label="Investigación · Argumentación bidireccional"
        title="Hipótesis"
        italic="contra hipótesis"
        subtitle="Plantea una tesis histórica. El sistema buscará evidencia a favor y en contra en paralelo, citando pasajes específicos del corpus. Útil para historiografía y argumentación."
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section style={{ padding: "44px 56px 0", maxWidth: 1320 }}>
        <div className="label" style={{ marginBottom: 14 }}>
          Tesis a evaluar
        </div>
        <textarea
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          placeholder='Ej: "Las reformas de López Pumarejo transformaron de modo decisivo la matriz social colombiana."'
          rows={2}
          style={{
            width: "100%",
            appearance: "none",
            background: "transparent",
            border: 0,
            borderBottom: "1px solid var(--line-strong)",
            outline: "none",
            resize: "vertical",
            fontFamily: "var(--font-display)",
            fontSize: 26,
            color: "var(--fg)",
            lineHeight: 1.35,
            padding: "12px 0",
            letterSpacing: "-0.01em",
          }}
        />
        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            {hypothesis.length} caracteres · mínimo 10
          </div>
          <button
            type="button"
            onClick={run}
            disabled={running || hypothesis.trim().length < 10}
            style={
              hypothesis.trim().length >= 10 && !running
                ? primaryBtn
                : { ...primaryBtn, opacity: 0.4, cursor: "default" }
            }
          >
            {running
              ? "Argumentando…"
              : phase === "done"
                ? "Re-argumentar"
                : "Argumentar →"}
          </button>
        </div>
      </section>

      <section
        style={{
          padding: "56px 56px 96px",
          maxWidth: 1320,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0,
          borderTop: "1px solid var(--line-strong)",
          marginTop: 32,
        }}
      >
        <div
          style={{
            padding: "32px 32px 32px 0",
            borderRight: "1px solid var(--line)",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}
          >
            <span style={{ width: 8, height: 8, background: "var(--success)" }} />
            <span className="label" style={{ color: "var(--success)" }}>
              En favor
            </span>
          </div>
          <HypothesisColumn result={forResult} />
        </div>
        <div style={{ padding: "32px 0 32px 32px" }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}
          >
            <span style={{ width: 8, height: 8, background: "var(--danger)" }} />
            <span className="label" style={{ color: "var(--danger)" }}>
              En contra
            </span>
          </div>
          <HypothesisColumn result={againstResult} />
        </div>
      </section>
    </div>
  );
}

function HypothesisColumn({ result }: { result: SideResult }) {
  if (result.status === "idle") {
    return (
      <div
        className="serif"
        style={{
          fontSize: 16,
          color: "var(--fg-faint)",
          fontStyle: "italic",
        }}
      >
        Plantea una tesis para comenzar.
      </div>
    );
  }
  if (result.status === "loading" && !result.answer) {
    return (
      <div
        className="fade-in"
        style={{ display: "flex", alignItems: "center", gap: 10 }}
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
        <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>
          Buscando evidencia…
        </span>
      </div>
    );
  }
  if (result.status === "error") {
    return (
      <div
        style={{
          padding: "12px 16px",
          border: "1px solid var(--danger)",
          color: "var(--danger)",
          fontSize: 13,
        }}
      >
        {result.answer || "Error al generar argumentación."}
      </div>
    );
  }
  return (
    <div className="fade-in">
      <div className="prose" style={{ maxWidth: "none", fontSize: 17 }}>
        {result.answer.split("\n").map((line, i) => {
          if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
          return (
            <p key={i} style={{ margin: "0 0 1em" }}>
              {renderInline(line, result.citations)}
            </p>
          );
        })}
      </div>
      {result.citations.length > 0 && (
        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
            fontSize: 12,
            color: "var(--fg-muted)",
          }}
        >
          {result.citations.length} pasajes citados
        </div>
      )}
    </div>
  );
}

function renderInline(text: string, chunks: ChunkCitation[]) {
  const parts: React.ReactNode[] = [];
  let r = text;
  let k = 0;
  while (r.length) {
    const m = r.match(/^\[#?(\d+)\]/);
    const bMatch = r.match(/^\*\*([^*]+)\*\*/);
    const iMatch = r.match(/^\*([^*]+)\*/);
    if (m) {
      const n = parseInt(m[1], 10);
      const chunk = chunks[n - 1];
      parts.push(
        <Cita
          key={k++}
          n={n}
          page={chunk?.pageNumber}
          doc={chunk?.documentFilename?.replace(/\.pdf$/i, "")}
        />,
      );
      r = r.slice(m[0].length);
    } else if (bMatch) {
      parts.push(<strong key={k++}>{bMatch[1]}</strong>);
      r = r.slice(bMatch[0].length);
    } else if (iMatch) {
      parts.push(<em key={k++}>{iMatch[1]}</em>);
      r = r.slice(iMatch[0].length);
    } else {
      const nextC = r.search(/\[#?\d+\]/);
      const nextB = r.indexOf("**");
      const nextI = r.indexOf("*");
      const candidates = [nextC, nextB, nextI].filter((x) => x >= 0);
      const stop = candidates.length ? Math.min(...candidates) : r.length;
      const slice = r.slice(0, Math.max(stop, 1));
      parts.push(<Fragment key={k++}>{slice}</Fragment>);
      r = r.slice(slice.length);
    }
  }
  return parts;
}
