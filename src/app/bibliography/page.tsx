"use client";

import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  PageHeader,
  FilterTabs,
  EmptyState,
  primaryBtn,
  ghostBtn,
} from "@/components/editorial";

type Style = "apa" | "chicago";

interface BibliographyData {
  style: Style;
  citations: Array<{
    author: string;
    year: string;
    title: string;
    publisher?: string;
    raw: string;
  }>;
  formatted: string[];
}

export default function BibliographyPage() {
  return (
    <Suspense fallback={<div style={{ padding: 56 }} />}>
      <BibliographyContent />
    </Suspense>
  );
}

function BibliographyContent() {
  const [style, setStyle] = useState<Style>("apa");
  const [data, setData] = useState<BibliographyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    const p = new URLSearchParams({ style });
    fetch(`/api/bibliography?${p}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: BibliographyData | null) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [style]);

  const copyAll = () => {
    if (!data) return;
    void navigator.clipboard.writeText(data.formatted.join("\n\n"));
    toast.success(`${data.formatted.length} referencias copiadas`);
  };

  const downloadBib = () => {
    if (!data) return;
    const blob = new Blob([data.formatted.join("\n\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bibliografia-${style}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-up" data-screen-label="Bibliography">
      <PageHeader
        label={`Producción · ${data?.citations.length ?? "—"} referencias`}
        title="Bibliografía"
        italic="generada"
        subtitle="Cada producción acumula sus fuentes. La bibliografía se mantiene sincronizada con el corpus enriquecido."
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              style={ghostBtn}
              onClick={copyAll}
              disabled={!data || data.formatted.length === 0}
            >
              Copiar todo
            </button>
            <button
              type="button"
              style={primaryBtn}
              onClick={downloadBib}
              disabled={!data || data.formatted.length === 0}
            >
              Descargar .txt
            </button>
          </div>
        }
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section style={{ padding: "20px 56px", maxWidth: 1320 }}>
        <FilterTabs<Style>
          value={style}
          onChange={setStyle}
          options={[
            { value: "apa", label: "APA 7" },
            { value: "chicago", label: "Chicago author-date" },
          ]}
        />
      </section>

      <section style={{ padding: "20px 56px 96px", maxWidth: 900 }}>
        {loading && (
          <div style={{ padding: "32px 0" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div className="shimmer-line" style={{ height: 14, width: "80%" }} />
              </div>
            ))}
          </div>
        )}
        {!loading && (!data || data.formatted.length === 0) && (
          <EmptyState
            title="Sin referencias"
            hint="Genera producciones para acumular fuentes citables."
          />
        )}
        {!loading && data && data.formatted.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {data.formatted.map((entry, i) => (
              <li
                key={i}
                style={{
                  padding: "20px 0",
                  borderTop:
                    i === 0 ? "1px solid var(--line-strong)" : "1px solid var(--line)",
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 32px",
                  gap: 18,
                  alignItems: "baseline",
                }}
              >
                <span
                  className="mono num"
                  style={{ fontSize: 11, color: "var(--fg-faint)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div
                  className="serif"
                  style={{ fontSize: 16, color: "var(--fg)", lineHeight: 1.55 }}
                  dangerouslySetInnerHTML={{
                    __html: entry
                      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
                      .replace(/_([^_]+)_/g, "<em>$1</em>"),
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(entry);
                    toast.success("Copiado");
                  }}
                  style={{
                    appearance: "none",
                    background: "transparent",
                    border: 0,
                    color: "var(--fg-faint)",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                    fontSize: 14,
                  }}
                  aria-label="Copiar"
                >
                  ⎘
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
