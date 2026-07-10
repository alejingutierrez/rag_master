"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, primaryBtn, ghostBtn } from "@/components/editorial";
import "./home-editor.css";

interface PubItem {
  id: string;
  title: string;
  typology: string | null;
  publishedAt: string | null;
}

const TYP_LABEL: Record<string, string> = {
  hecho: "Hecho",
  epoca: "Época",
  entidad: "Entidad",
  pregunta: "Pregunta",
};

const selectStyle: React.CSSProperties = {
  appearance: "none",
  background: "var(--bg)",
  border: "1px solid var(--line-strong)",
  padding: "9px 12px",
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  color: "var(--fg)",
  width: "100%",
  maxWidth: 560,
};

const inputStyle: React.CSSProperties = { ...selectStyle };

function SectionTitle({ n, title, hint }: { n: string; title: string; hint: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-faint)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {n}
      </div>
      <h2 className="display" style={{ fontSize: 26, margin: "4px 0 4px", color: "var(--fg)" }}>
        {title}
      </h2>
      <p style={{ fontSize: 13.5, color: "var(--fg-muted)", margin: 0, maxWidth: 620, lineHeight: 1.5 }}>{hint}</p>
    </div>
  );
}

export default function HomeEditorPage() {
  const [items, setItems] = useState<PubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [heroId, setHeroId] = useState("");
  const [featured, setFeatured] = useState<string[]>([]);
  const [collTitle, setCollTitle] = useState("");
  const [collSubtitle, setCollSubtitle] = useState("");
  const [collItems, setCollItems] = useState<string[]>([]);
  const [qMode, setQMode] = useState<"deliverable" | "free">("free");
  const [qId, setQId] = useState("");
  const [qTitle, setQTitle] = useState("");
  const [qAnswer, setQAnswer] = useState("");
  const [qHref, setQHref] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [dRes, cRes] = await Promise.all([
          fetch("/api/deliverables?source=atelier&limit=200"),
          fetch("/api/home-config"),
        ]);
        const dJson = await dRes.json();
        const pub: PubItem[] = (dJson.deliverables ?? [])
          .filter((d: { publishedAt?: string | null }) => d.publishedAt)
          .map((d: { id: string; userQuestion?: string; question?: { pregunta?: string }; structuredData?: { typology?: string; titulo?: string }; publishedAt: string }) => ({
            id: d.id,
            title: d.structuredData?.titulo ?? d.question?.pregunta ?? d.userQuestion ?? d.id,
            typology: d.structuredData?.typology ?? null,
            publishedAt: d.publishedAt,
          }));
        setItems(pub);

        const cfg = await cRes.json();
        setHeroId(cfg.hero?.deliverableId ?? "");
        setFeatured(Array.isArray(cfg.featured) ? cfg.featured : []);
        setCollTitle(cfg.collection?.title ?? "");
        setCollSubtitle(cfg.collection?.subtitle ?? "");
        setCollItems(cfg.collection?.items ?? []);
        if (cfg.questionOfWeek?.deliverableId) {
          setQMode("deliverable");
          setQId(cfg.questionOfWeek.deliverableId);
        } else if (cfg.questionOfWeek?.title) {
          setQMode("free");
          setQTitle(cfg.questionOfWeek.title ?? "");
          setQAnswer(cfg.questionOfWeek.answer ?? "");
          setQHref(cfg.questionOfWeek.href ?? "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const preguntas = useMemo(() => items.filter((i) => i.typology === "pregunta"), [items]);

  function toggle(list: string[], set: (v: string[]) => void, id: string, max: number) {
    if (list.includes(id)) set(list.filter((x) => x !== id));
    else if (list.length < max) set([...list, id]);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const body = {
        hero: { deliverableId: heroId },
        featured,
        collection: { title: collTitle, subtitle: collSubtitle, items: collItems },
        questionOfWeek:
          qMode === "deliverable"
            ? qId && qId !== heroId
              ? { deliverableId: qId }
              : {}
            : { title: qTitle, answer: qAnswer, href: qHref },
      };
      const res = await fetch("/api/home-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  const label = (id: string) => items.find((i) => i.id === id)?.title ?? id;

  return (
    <div className="fade-up" data-screen-label="HomeEditor">
      <PageHeader
        label="Producción · Editor del home"
        title="Editor del home"
        italic="portada"
        subtitle="Construye la portada con piezas ya publicadas. El sistema valida cada referencia contra la base y descarta automáticamente contenidos despublicados."
        action={
          <button type="button" style={primaryBtn} onClick={save} disabled={saving}>
            {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar portada"}
          </button>
        }
      />
      <hr className="hairline home-editor-rule" />

      {loading ? (
        <div style={{ padding: 56 }}>
          <div className="shimmer-line" style={{ height: 20, width: 240 }} />
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: 56, maxWidth: 620 }}>
          <p style={{ fontSize: 16, color: "var(--fg-muted)", lineHeight: 1.5 }}>
            Aún no hay producciones publicadas. Publica piezas desde Producciones y volverán a aparecer
            aquí para armar la portada.
          </p>
        </div>
      ) : (
        <div className="home-editor-body">
          {/* Hero */}
          <section>
            <SectionTitle n="01" title="Pieza de apertura" hint="La historia que ocupa el gran plano editorial al comenzar la portada." />
            <select value={heroId} onChange={(e) => setHeroId(e.target.value)} style={selectStyle}>
              <option value="">— Usar el default —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.typology ? `[${TYP_LABEL[i.typology] ?? i.typology}] ` : ""}
                  {i.title}
                </option>
              ))}
            </select>
          </section>

          {/* Featured */}
          <section>
            <SectionTitle n="02" title="En el archivo (hasta 3)" hint="La pequeña mesa de lectura que acompaña la pieza de apertura." />
            <PickList items={items} selected={featured} onToggle={(id) => toggle(featured, setFeatured, id, 3)} />
          </section>

          {/* Collection */}
          <section>
            <SectionTitle n="03" title="Secuencia curada (hasta 4)" hint="Un recorrido temático ordenado. El orden de selección es el orden de lectura." />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <input
                value={collTitle}
                onChange={(e) => setCollTitle(e.target.value)}
                placeholder="Título de la colección (p. ej. Las constituciones de Colombia)"
                style={inputStyle}
              />
              <input
                value={collSubtitle}
                onChange={(e) => setCollSubtitle(e.target.value)}
                placeholder="Subtítulo"
                style={inputStyle}
              />
            </div>
            <PickList items={items} selected={collItems} onToggle={(id) => toggle(collItems, setCollItems, id, 4)} />
          </section>

          {/* Question of week */}
          <section>
            <SectionTitle n="04" title="Pregunta abierta (opcional)" hint="Una lectura publicada distinta de la pieza de apertura, o un texto libre breve." />
            <div className="home-editor-modes">
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                <input type="radio" checked={qMode === "deliverable"} onChange={() => setQMode("deliverable")} />
                Una pregunta publicada
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                <input type="radio" checked={qMode === "free"} onChange={() => setQMode("free")} />
                Texto libre
              </label>
            </div>
            {qMode === "deliverable" ? (
              <select value={qId} onChange={(e) => setQId(e.target.value)} style={selectStyle}>
                <option value="">— Elegir pregunta —</option>
                {(preguntas.length ? preguntas : items).map((i) => (
                  <option key={i.id} value={i.id} disabled={i.id === heroId}>
                    {i.title}{i.id === heroId ? " — ya es la apertura" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={qTitle} onChange={(e) => setQTitle(e.target.value)} placeholder="La pregunta" style={inputStyle} />
                <textarea
                  value={qAnswer}
                  onChange={(e) => setQAnswer(e.target.value)}
                  placeholder="La respuesta breve"
                  style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                />
                <input value={qHref} onChange={(e) => setQHref(e.target.value)} placeholder="Enlace (opcional, p. ej. /preguntas/…)" style={inputStyle} />
              </div>
            )}
            {qMode === "deliverable" && qId && qId === heroId ? (
              <p className="home-editor-warning">La pregunta coincide con la apertura y no se publicará dos veces. Elige otra pieza.</p>
            ) : null}
          </section>

          <div className="home-editor-actions">
            <button type="button" style={primaryBtn} onClick={save} disabled={saving}>
              {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar portada"}
            </button>
            <a href="/" target="_blank" rel="noreferrer" style={{ ...ghostBtn, textDecoration: "none" }}>
              Ver portada ↗
            </a>
            <span className="mono home-editor-summary">
              apertura: {heroId ? label(heroId) : "default"} · archivo: {featured.length} · secuencia: {collItems.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PickList({
  items,
  selected,
  onToggle,
}: {
  items: PubItem[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="home-editor-picks">
      {items.map((i) => {
        const on = selected.includes(i.id);
        const order = selected.indexOf(i.id) + 1;
        return (
          <li key={i.id} style={{ background: "var(--bg)" }}>
            <button
              type="button"
              onClick={() => onToggle(i.id)}
              style={{
                width: "100%",
                appearance: "none",
                border: 0,
                background: on ? "var(--bg-muted)" : "transparent",
                padding: "12px 14px",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  flexShrink: 0,
                  border: "1px solid var(--line-strong)",
                  background: on ? "var(--fg)" : "transparent",
                  color: "var(--bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {on ? order : ""}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="mono" style={{ fontSize: 9.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {i.typology ? TYP_LABEL[i.typology] ?? i.typology : "Ensayo"}
                </span>
                <span style={{ display: "block", fontSize: 13.5, color: "var(--fg)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {i.title}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
