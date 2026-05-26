"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  PageHeader,
  SectionHeader,
  FormField,
  Pill,
  primaryBtn,
  ghostBtn,
} from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";

interface DocumentRow {
  id: string;
  filename: string;
  status: string;
  pageCount: number;
  enriched: boolean;
  metadata: {
    bookTitle?: string;
    author?: string;
    publicationYear?: number | string;
    publisher?: string;
    isbn?: string;
    edition?: string;
    summary?: string;
    primaryPeriod?: string;
    secondaryPeriod?: string;
    primaryCategory?: string;
    secondaryCategory?: string;
    keywords?: string[];
  };
  _count: { chunks: number };
}

const CATEGORIES = [
  "Política y Estado",
  "Conflicto Armado",
  "Religión",
  "Cultura",
  "Economía",
  "Sociedad",
  "Movimientos",
  "Territorio",
];

export default function EnrichPage() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    fetch("/api/documents?limit=500&status=READY", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { documents: [] }))
      .then((data) => {
        if (cancelled) return;
        setDocs(data.documents ?? []);
        if (!selectedId && data.documents?.length) {
          const firstPending = data.documents.find((d: DocumentRow) => !d.enriched);
          setSelectedId(firstPending?.id ?? data.documents[0].id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const pending = useMemo(() => docs.filter((d) => !d.enriched), [docs]);
  const selected = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? pending[0] ?? docs[0],
    [docs, selectedId, pending],
  );

  return (
    <div className="fade-up" data-screen-label="Enrich">
      <PageHeader
        label="Repositorio"
        title="Enriquecer"
        italic="metadata histórica"
        subtitle={`${pending.length} documentos pendientes de enriquecimiento. Claude Opus 4.7 extrae período, categorías, entidades y geografía a partir del contenido completo.`}
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section
        style={{
          padding: "44px 56px 96px",
          maxWidth: 1320,
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 56,
        }}
      >
        {/* Sidebar */}
        <aside>
          <div className="label" style={{ marginBottom: 14 }}>
            Pendientes · {pending.length}
          </div>
          {loading && (
            <div className="shimmer-line" style={{ height: 14, width: "70%" }} />
          )}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {pending.length === 0 && !loading && (
              <li
                style={{
                  padding: "16px 0",
                  fontSize: 13,
                  color: "var(--fg-faint)",
                }}
              >
                Todos los documentos están enriquecidos.
              </li>
            )}
            {pending.map((d, i) => {
              const active = d.id === selectedId;
              const title = d.metadata?.bookTitle ?? d.filename.replace(/\.pdf$/i, "");
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    style={{
                      width: "100%",
                      appearance: "none",
                      background: active ? "var(--bg-muted)" : "transparent",
                      border: 0,
                      borderTop: i === 0 ? "1px solid var(--line)" : 0,
                      borderBottom: "1px solid var(--line)",
                      padding: "14px 12px",
                      cursor: "pointer",
                      textAlign: "left",
                      position: "relative",
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          background: "var(--accent)",
                        }}
                      />
                    )}
                    <div
                      className="serif"
                      style={{
                        fontSize: 14,
                        color: "var(--fg)",
                        lineHeight: 1.3,
                      }}
                    >
                      {title}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-muted)", marginTop: 4 }}>
                      {d.metadata?.author ?? "Sin autor"} · {d.pageCount} pp
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Form */}
        {selected && (
          <EnrichForm
            doc={selected}
            onSaved={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </section>
    </div>
  );
}

function EnrichForm({
  doc,
  onSaved,
}: {
  doc: DocumentRow;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    bookTitle: doc.metadata?.bookTitle ?? "",
    author: doc.metadata?.author ?? "",
    publicationYear: doc.metadata?.publicationYear?.toString() ?? "",
    publisher: doc.metadata?.publisher ?? "",
    isbn: doc.metadata?.isbn ?? "",
    edition: doc.metadata?.edition ?? "",
    summary: doc.metadata?.summary ?? "",
    primaryPeriod: doc.metadata?.primaryPeriod ?? "",
    secondaryPeriod: doc.metadata?.secondaryPeriod ?? "",
    primaryCategory: doc.metadata?.primaryCategory ?? "",
    secondaryCategory: doc.metadata?.secondaryCategory ?? "",
  });
  const [keywords, setKeywords] = useState<string[]>(doc.metadata?.keywords ?? []);
  const [saving, setSaving] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);

  // Reset form when doc changes.
  useEffect(() => {
    setForm({
      bookTitle: doc.metadata?.bookTitle ?? "",
      author: doc.metadata?.author ?? "",
      publicationYear: doc.metadata?.publicationYear?.toString() ?? "",
      publisher: doc.metadata?.publisher ?? "",
      isbn: doc.metadata?.isbn ?? "",
      edition: doc.metadata?.edition ?? "",
      summary: doc.metadata?.summary ?? "",
      primaryPeriod: doc.metadata?.primaryPeriod ?? "",
      secondaryPeriod: doc.metadata?.secondaryPeriod ?? "",
      primaryCategory: doc.metadata?.primaryCategory ?? "",
      secondaryCategory: doc.metadata?.secondaryCategory ?? "",
    });
    setKeywords(doc.metadata?.keywords ?? []);
  }, [doc.id]);

  const updateField = (field: keyof typeof form) => (v: string) =>
    setForm((p) => ({ ...p, [field]: v }));

  const togglePeriod = (code: PeriodCode) => {
    setForm((p) => ({
      ...p,
      primaryPeriod: p.primaryPeriod === code ? "" : code,
    }));
  };

  const toggleCategory = (cat: string) => {
    setForm((p) => ({
      ...p,
      primaryCategory: p.primaryCategory === cat ? "" : cat,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        bookTitle: form.bookTitle || undefined,
        author: form.author || undefined,
        publisher: form.publisher || undefined,
        publicationYear: form.publicationYear
          ? Number(form.publicationYear)
          : undefined,
        edition: form.edition || undefined,
        isbn: form.isbn || undefined,
        summary: form.summary || undefined,
        primaryPeriod: form.primaryPeriod || undefined,
        secondaryPeriod: form.secondaryPeriod || undefined,
        primaryCategory: form.primaryCategory || undefined,
        secondaryCategory: form.secondaryCategory || undefined,
        keywords,
      };
      const res = await fetch(`/api/documents/${doc.id}/enrich`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: payload }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Metadata guardada");
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleAI = async () => {
    setAiRunning(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}/enrich`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("AI failed");
      toast.success("Documento enriquecido con IA");
      onSaved();
    } catch {
      toast.error("Error al enriquecer con IA");
    } finally {
      setAiRunning(false);
    }
  };

  const title = doc.metadata?.bookTitle ?? doc.filename.replace(/\.pdf$/i, "");

  return (
    <div>
      <SectionHeader
        index="01"
        title={title}
        caption={`${doc.metadata?.author ?? "Sin autor"} · ${doc.pageCount} pp · ${doc._count.chunks.toLocaleString("es-CO")} fragmentos`}
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              style={ghostBtn}
              onClick={handleAI}
              disabled={aiRunning}
            >
              {aiRunning ? "Enriqueciendo…" : "Enriquecer con IA"}
            </button>
            <button
              type="button"
              style={primaryBtn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar →"}
            </button>
          </div>
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginBottom: 36,
        }}
      >
        <FormField
          label="Título canónico"
          value={form.bookTitle}
          onChange={updateField("bookTitle")}
        />
        <FormField
          label="Autor principal"
          value={form.author}
          onChange={updateField("author")}
        />
        <FormField
          label="Año publicación"
          value={form.publicationYear}
          onChange={updateField("publicationYear")}
        />
        <FormField
          label="Editorial"
          value={form.publisher}
          onChange={updateField("publisher")}
        />
        <FormField
          label="ISBN"
          value={form.isbn}
          onChange={updateField("isbn")}
        />
        <FormField
          label="Edición"
          value={form.edition}
          onChange={updateField("edition")}
        />
      </div>

      <div className="label" style={{ marginBottom: 12 }}>
        Período histórico
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 36 }}>
        {(Object.keys(PERIODS) as PeriodCode[])
          .filter((c) => c !== "TRANS")
          .map((code) => (
            <Pill
              key={code}
              active={form.primaryPeriod === code}
              onClick={() => togglePeriod(code)}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: `var(--p-${PERIODS[code].slug})`,
                }}
              />
              {PERIODS[code].label}
            </Pill>
          ))}
      </div>

      <div className="label" style={{ marginBottom: 12 }}>
        Categoría principal
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 36 }}>
        {CATEGORIES.map((c) => (
          <Pill
            key={c}
            active={form.primaryCategory === c}
            onClick={() => toggleCategory(c)}
          >
            {c}
          </Pill>
        ))}
      </div>

      {keywords.length > 0 && (
        <>
          <div className="label" style={{ marginBottom: 12 }}>
            Palabras clave · {keywords.length}
          </div>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 36 }}
          >
            {keywords.map((kw) => (
              <Pill
                key={kw}
                onClick={() => setKeywords((p) => p.filter((k) => k !== kw))}
              >
                {kw} ×
              </Pill>
            ))}
          </div>
        </>
      )}

      <FormField
        label="Resumen historiográfico"
        value={form.summary}
        onChange={updateField("summary")}
        multiline
        rows={6}
        placeholder="Resumen extenso del contenido y aporte historiográfico del documento."
      />
    </div>
  );
}
