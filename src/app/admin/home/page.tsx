"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, primaryBtn, ghostBtn } from "@/components/editorial";

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
            ? { deliverableId: qId }
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
        subtitle="Elige qué piezas publicadas aparecen en la portada. Solo se pueden elegir producciones ya publicadas. Lo que dejes en blanco usa el default."
        action={
          <button type="button" style={primaryBtn} onClick={save} disabled={saving}>
            {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar portada"}
          </button>
        }
      />
      <hr className="hairline" style={{ margin: "0 56px" }} />

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
        <div style={{ padding: "32px 56px 80px", maxWidth: 900, display: "flex", flexDirection: "column", gap: 48 }}>
          {/* Hero */}
          <section>
            <SectionTitle n="01" title="Destacado (hero)" hint="La pieza grande en la parte superior de la portada." />
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
            <SectionTitle n="02" title="En portada (hasta 3)" hint="La fila de tres tarjetas destacadas." />
            <PickList items={items} selected={featured} onToggle={(id) => toggle(featured, setFeatured, id, 3)} />
          </section>

          {/* Collection */}
          <section>
            <SectionTitle n="03" title="Colección (hasta 4)" hint="Una colección temática con su título y subtítulo." />
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
            <SectionTitle n="04" title="La pregunta de la semana" hint="Una pregunta publicada, o un texto libre." />
            <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
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
                  <option key={i.id} value={i.id}>
                    {i.title}
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
          </section>

          <div style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 24 }}>
            <button type="button" style={primaryBtn} onClick={save} disabled={saving}>
              {saving ? "Guardando…" : saved ? "Guardado ✓" : "Guardar portada"}
            </button>
            <a href="/" target="_blank" rel="noreferrer" style={{ ...ghostBtn, textDecoration: "none" }}>
              Ver portada ↗
            </a>
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
              hero: {heroId ? label(heroId) : "default"} · destacados: {featured.length} · colección: {collItems.length}
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
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
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
