"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { TypographicVideo } from "@/remotion-comp/video/TypographicVideo";
// Solo cliente: la composición usa fitText (measureText), que no existe en SSR.
const Player = dynamic(() => import("@remotion/player").then((m) => m.Player), { ssr: false });
import type { TypographicScore } from "@/lib/video/score";
import { VIDEO_STYLES } from "@/lib/video/styles";

type Phase = "idle" | "working" | "done" | "error";

export default function VideoStudioPage() {
  const [topic, setTopic] = useState("");
  const [styleId, setStyleId] = useState(VIDEO_STYLES[0].id);
  const [durationSec, setDurationSec] = useState(30);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [score, setScore] = useState<TypographicScore | null>(null);
  const [imagesUsed, setImagesUsed] = useState<number | null>(null);
  const [rendering, setRendering] = useState(false);
  const [mp4Url, setMp4Url] = useState<string>("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const generate = useCallback(async () => {
    if (topic.trim().length < 3) return;
    stopPoll();
    setPhase("working"); setStage("iniciando…"); setError(""); setScore(null); setMp4Url(""); setImagesUsed(null);
    let id = "";
    try {
      const res = await fetch("/api/video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), styleId, durationSec }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al iniciar");
      id = data.deliverableId;
    } catch (e) { setPhase("error"); setError((e as Error).message); return; }

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/deliverables/${id}`, { cache: "no-store" });
        const d = await r.json();
        const del = d?.deliverable ?? d;
        const v = del?.metadata?.video;
        if (v?.message || v?.stage) setStage(v.message || v.stage);
        if (del?.status === "COMPLETE" && v?.score) {
          stopPoll(); setScore(v.score as TypographicScore); setImagesUsed(v.imagesUsed ?? 0); setPhase("done"); setStage("listo");
        } else if (del?.status === "ERROR") {
          stopPoll(); setPhase("error"); setError(v?.error || "Falló la generación");
        }
      } catch { /* reintenta en el siguiente tick */ }
    }, 2000);
  }, [topic, styleId, durationSec]);

  const renderMp4 = useCallback(async (id: string) => {
    setRendering(true); setMp4Url("");
    try {
      const r = await fetch(`/api/video/render`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "Error al renderizar");
      setMp4Url(d.url);
    } catch (e) { setError((e as Error).message); }
    setRendering(false);
  }, [score]);

  const downloadScore = () => {
    if (!score) return;
    const blob = new Blob([JSON.stringify(score, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `partitura-${score.meta.periodCode}.json`;
    a.click();
  };

  const durSec = score ? (score.meta.durationInFrames / score.meta.fps).toFixed(1) : null;
  const inputProps = useMemo(() => score ?? undefined, [score]);

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 24px", fontFamily: "var(--font-sans, system-ui)" }}>
      <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-subtle,#737373)" }}>El Taller · Video</p>
      <h1 style={{ fontFamily: "var(--font-display, Georgia, serif)", fontSize: 42, lineHeight: 1.05, margin: "6px 0 4px" }}>Estudio de video</h1>
      <p style={{ color: "var(--fg-muted,#525252)", fontSize: 15, marginBottom: 28 }}>Un tema + un tipo → guion verificado, con búsqueda de archivo. Preview en vivo, sin renderizar.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Formulario */}
        <div style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelCss}>Tema</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej. La Batalla de Boyacá"
              style={inputCss} onKeyDown={(e) => { if (e.key === "Enter") generate(); }} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelCss}>Tipo</span>
            <select value={styleId} onChange={(e) => setStyleId(e.target.value)} style={inputCss}>
              {VIDEO_STYLES.map((s) => (<option key={s.id} value={s.id}>{s.label} — {s.imageUsage === "none" ? "sin imagen" : s.imageUsage === "minimal" ? "imagen mínima" : "con imagen"}</option>))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={labelCss}>Duración objetivo: {durationSec}s <span style={{ color: "var(--fg-faint,#a3a3a3)" }}>(el ritmo final lo manda la lectura)</span></span>
            <input type="range" min={15} max={75} value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} />
          </label>
          <button onClick={generate} disabled={phase === "working" || topic.trim().length < 3} style={btnCss(phase === "working")}>
            {phase === "working" ? "Generando…" : "Generar"}
          </button>

          {phase === "working" && <p style={{ fontFamily: "var(--font-mono,monospace)", fontSize: 13, color: "var(--fg-muted,#525252)" }}>· {stage}</p>}
          {phase === "error" && <p style={{ color: "var(--danger,#b91c1c)", fontSize: 14 }}>✗ {error}</p>}

          {phase === "done" && score && (
            <div style={{ borderTop: "1px solid var(--line,#ebebeb)", paddingTop: 16, display: "grid", gap: 10 }}>
              <p style={{ fontSize: 14 }}><strong>{score.meta.title}</strong> · {score.meta.periodLabel}</p>
              <p style={{ fontFamily: "var(--font-mono,monospace)", fontSize: 12, color: "var(--fg-muted,#525252)" }}>
                {score.scenes.length} escenas · {durSec}s · {imagesUsed ?? 0} imágenes de archivo
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={downloadScore} style={btnGhost}>Descargar partitura</button>
                <button onClick={() => renderMp4("")} disabled={rendering} style={btnGhost}>{rendering ? "Renderizando MP4…" : "Renderizar MP4 (local)"}</button>
              </div>
              {mp4Url && <a href={mp4Url} download style={{ fontSize: 14, color: "var(--accent,#c2410c)" }}>↓ Descargar {mp4Url.split("/").pop()}</a>}
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          <div style={{ background: "#0a0a0a", borderRadius: 2, padding: 10, display: "grid", placeItems: "center", minHeight: 480 }}>
            {score && inputProps ? (
              <Player
                component={TypographicVideo as never}
                inputProps={inputProps as never}
                durationInFrames={score.meta.durationInFrames}
                fps={score.meta.fps}
                compositionWidth={score.meta.width}
                compositionHeight={score.meta.height}
                style={{ width: 270, height: 480, borderRadius: 2 }}
                controls loop acknowledgeRemotionLicense
              />
            ) : (
              <p style={{ color: "#666", fontFamily: "var(--font-mono,monospace)", fontSize: 12 }}>{phase === "working" ? "generando…" : "el preview aparecerá aquí"}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelCss: React.CSSProperties = { fontFamily: "var(--font-mono,monospace)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-subtle,#737373)" };
const inputCss: React.CSSProperties = { padding: "10px 12px", border: "1px solid var(--line-strong,#d4d4d4)", background: "var(--bg,#fff)", fontSize: 15, color: "var(--fg,#0a0a0a)", borderRadius: 0 };
const btnCss = (busy: boolean): React.CSSProperties => ({ padding: "12px 18px", background: busy ? "var(--fg-faint,#a3a3a3)" : "var(--fg,#0a0a0a)", color: "#fff", border: 0, fontSize: 14, cursor: busy ? "default" : "pointer", borderRadius: 0 });
const btnGhost: React.CSSProperties = { padding: "9px 14px", background: "transparent", color: "var(--fg,#0a0a0a)", border: "1px solid var(--line-strong,#d4d4d4)", fontSize: 13, cursor: "pointer", borderRadius: 0 };
