"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FilterTabs,
  SearchInput,
  PeriodTag,
  StatusDot,
  SectionHeader,
  linkBtn,
  ghostBtn,
} from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";

interface Chunk {
  id: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  chunkSize: number;
  overlap: number;
  strategy: string;
}

interface EnrichmentMetadata {
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
}

interface DocumentDetail {
  id: string;
  filename: string;
  s3Url: string;
  fileSize: number;
  pageCount: number;
  status: "PENDING" | "PROCESSING" | "READY" | "ERROR";
  enriched: boolean;
  metadata: EnrichmentMetadata;
  error?: string;
  createdAt: string;
  updatedAt: string;
  chunks: Chunk[];
}

function formatBytes(n: number) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

type Tab = "overview" | "chunks" | "metadata";

const STATUS_MAP: Record<
  DocumentDetail["status"],
  { kind: "success" | "warning" | "danger" | "muted"; label: string }
> = {
  READY: { kind: "success", label: "Listo" },
  PROCESSING: { kind: "warning", label: "Procesando" },
  PENDING: { kind: "muted", label: "Pendiente" },
  ERROR: { kind: "danger", label: "Error" },
};

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!id) return;
    const ctrl = new AbortController();
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/documents/${id}`, { signal: ctrl.signal });
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setDoc(data.document);
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    let delay = 3000;
    let tid: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) return;
      await load();
      // backoff suave
      delay = Math.min(delay * 1.3, 15000);
      if (doc?.status === "PROCESSING") tid = setTimeout(tick, delay);
    };
    if (doc?.status === "PROCESSING") tid = setTimeout(tick, delay);

    return () => {
      cancelled = true;
      ctrl.abort();
      if (tid) clearTimeout(tid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, doc?.status]);

  const filteredChunks = useMemo(() => {
    if (!doc) return [];
    const q = search.trim().toLowerCase();
    if (!q) return doc.chunks;
    return doc.chunks.filter((c) => c.content.toLowerCase().includes(q));
  }, [doc, search]);

  if (notFound) {
    return (
      <div className="fade-up" style={{ padding: "96px 56px", maxWidth: 760 }}>
        <div className="label" style={{ marginBottom: 16 }}>
          404
        </div>
        <h1 className="display" style={{ fontSize: 56, margin: 0 }}>
          Documento no encontrado.
        </h1>
        <button
          type="button"
          onClick={() => router.push("/documents")}
          style={{ ...ghostBtn, marginTop: 28 }}
        >
          ← Volver a documentos
        </button>
      </div>
    );
  }

  if (loading || !doc) {
    return (
      <div className="fade-up" style={{ padding: "96px 56px", maxWidth: 760 }}>
        <div className="shimmer-line" style={{ height: 16, width: 200, marginBottom: 24 }} />
        <div className="shimmer-line" style={{ height: 48, width: "80%", marginBottom: 16 }} />
        <div className="shimmer-line" style={{ height: 48, width: "60%" }} />
      </div>
    );
  }

  const m = doc.metadata ?? {};
  const title = m.bookTitle?.trim() || doc.filename.replace(/\.pdf$/i, "");
  const periodCode = m.primaryPeriod && m.primaryPeriod in PERIODS ? (m.primaryPeriod as PeriodCode) : null;
  const status = STATUS_MAP[doc.status];

  return (
    <div className="fade-up" style={{ paddingBottom: 96 }} data-screen-label="DocumentDetail">
      <section style={{ padding: "32px 56px 12px", maxWidth: 1320 }}>
        <button
          type="button"
          onClick={() => router.push("/documents")}
          style={{ ...linkBtn, fontSize: 12 }}
        >
          ← Documentos
        </button>
      </section>

      <section style={{ padding: "16px 56px 32px", maxWidth: 1320 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          {periodCode && <PeriodTag code={periodCode} showName />}
          {periodCode && <span style={{ color: "var(--fg-dim)" }}>·</span>}
          <StatusDot kind={status.kind} label={status.label} />
          {doc.enriched && (
            <>
              <span style={{ color: "var(--fg-dim)" }}>·</span>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Enriquecido
              </span>
            </>
          )}
        </div>

        <h1
          className="display"
          style={{
            fontSize: "clamp(40px, 5.5vw, 72px)",
            margin: 0,
            color: "var(--fg)",
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            maxWidth: 1000,
          }}
        >
          {title}
        </h1>
        {m.author && (
          <div
            className="serif"
            style={{
              fontSize: 19,
              color: "var(--fg-muted)",
              marginTop: 16,
              fontStyle: "italic",
            }}
          >
            {m.author}
            {m.publicationYear && ` · ${m.publicationYear}`}
          </div>
        )}

        <div
          style={{
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            borderTop: "1px solid var(--line)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          {[
            ["Páginas", doc.pageCount.toString()],
            ["Fragmentos", doc.chunks.length.toLocaleString("es-CO")],
            ["Tamaño", formatBytes(doc.fileSize)],
            [
              "Subido",
              new Date(doc.createdAt).toLocaleDateString("es-CO", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
            ],
          ].map(([l, v], i) => (
            <div
              key={i}
              style={{
                padding: "20px 24px 20px 0",
                borderLeft: i === 0 ? 0 : "1px solid var(--line)",
                paddingLeft: i === 0 ? 0 : 24,
              }}
            >
              <div className="label" style={{ marginBottom: 8 }}>
                {l}
              </div>
              <div
                className="display num"
                style={{ fontSize: 22, color: "var(--fg)", lineHeight: 1 }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: "0 56px", maxWidth: 1320 }}>
        <FilterTabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Resumen" },
            {
              value: "chunks",
              label: `Fragmentos · ${doc.chunks.length.toLocaleString("es-CO")}`,
            },
            { value: "metadata", label: "Metadata" },
          ]}
        />
      </section>

      {tab === "overview" && (
        <section
          style={{
            padding: "44px 56px 0",
            maxWidth: 1320,
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 64,
          }}
        >
          <div>
            <SectionHeader
              title="Resumen historiográfico"
              caption="Generado a partir del enriquecimiento"
            />
            <p
              className="serif"
              style={{
                fontSize: 18,
                color: "var(--fg)",
                lineHeight: 1.65,
                maxWidth: 640,
              }}
            >
              {m.summary ?? "Sin resumen aún. Enriquece este documento para generar uno automáticamente."}
            </p>
          </div>
          <div>
            <SectionHeader
              title="Palabras clave"
              caption={`${m.keywords?.length ?? 0} extraídas`}
            />
            {m.keywords && m.keywords.length > 0 ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {m.keywords.slice(0, 12).map((kw, i) => (
                  <li
                    key={i}
                    style={{
                      borderTop: i === 0 ? 0 : "1px solid var(--line)",
                      padding: "12px 0",
                    }}
                  >
                    <span className="serif" style={{ fontSize: 15, color: "var(--fg)" }}>
                      {kw}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: "var(--fg-muted)" }}>—</p>
            )}
          </div>
        </section>
      )}

      {tab === "chunks" && (
        <section style={{ padding: "44px 56px 0", maxWidth: 1320 }}>
          <div style={{ marginBottom: 24 }}>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar en fragmentos…"
              width={420}
            />
          </div>
          <div className="label" style={{ marginBottom: 18 }}>
            Mostrando {filteredChunks.length.toLocaleString("es-CO")} de{" "}
            {doc.chunks.length.toLocaleString("es-CO")} fragmentos
          </div>
          {filteredChunks.slice(0, 30).map((c, i) => (
            <div
              key={c.id}
              style={{
                borderTop: i === 0 ? "1px solid var(--line-strong)" : "1px solid var(--line)",
                padding: "24px 0",
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 48,
                alignItems: "baseline",
                maxWidth: 1100,
              }}
            >
              <div>
                <div
                  className="display num"
                  style={{ fontSize: 24, color: "var(--fg)", lineHeight: 1 }}
                >
                  p.{c.pageNumber}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: "var(--fg-faint)",
                    marginTop: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Fragmento {String(c.chunkIndex).padStart(4, "0")}
                </div>
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 17,
                  lineHeight: 1.6,
                  color: "var(--fg)",
                }}
              >
                {c.content.slice(0, 600)}
                {c.content.length > 600 && "…"}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "metadata" && (
        <section style={{ padding: "44px 56px 0", maxWidth: 760 }}>
          <dl style={{ margin: 0 }}>
            {[
              ["ID", doc.id],
              ["Filename", doc.filename],
              ["Autor", m.author ?? "—"],
              ["Año", m.publicationYear ?? "—"],
              ["Editorial", m.publisher ?? "—"],
              ["ISBN", m.isbn ?? "—"],
              ["Edición", m.edition ?? "—"],
              [
                "Período",
                periodCode ? `${periodCode} · ${PERIODS[periodCode].label}` : "—",
              ],
              ["Período secundario", m.secondaryPeriod ?? "—"],
              ["Categoría", m.primaryCategory ?? "—"],
              [
                "Chunks",
                `${doc.chunks.length.toLocaleString("es-CO")} fragmentos`,
              ],
              ["Embedding", "Cohere embed-v4.0"],
            ].map(([k, v], i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "200px 1fr",
                  gap: 24,
                  padding: "14px 0",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <dt className="label" style={{ alignSelf: "baseline" }}>
                  {k}
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "var(--fg)",
                    wordBreak: "break-word",
                  }}
                >
                  {String(v ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
