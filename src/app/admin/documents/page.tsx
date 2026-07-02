"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHeader,
  FilterTabs,
  SearchInput,
  EmptyState,
  PeriodTag,
  StatusDot,
  primaryBtn,
} from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";

type DocStatus = "PENDING" | "PROCESSING" | "READY" | "ERROR";
type StatusFilter = "all" | DocStatus;

interface DocItem {
  id: string;
  filename: string;
  status: DocStatus;
  pageCount: number;
  createdAt: string;
  enriched: boolean;
  metadata?: Record<string, unknown> | null;
  fileSize?: number;
  _count: { chunks: number };
}

interface DocsResponse {
  documents: DocItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function getDocTitle(doc: DocItem): string {
  const meta = doc.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const bookTitle = (meta as Record<string, unknown>).bookTitle;
    if (typeof bookTitle === "string" && bookTitle.trim()) return bookTitle.trim();
  }
  return doc.filename.replace(/\.pdf$/i, "");
}

function getDocAuthor(doc: DocItem): string | null {
  const meta = doc.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const author = (meta as Record<string, unknown>).author;
    if (typeof author === "string" && author.trim()) return author.trim();
  }
  return null;
}

function getDocYear(doc: DocItem): number | null {
  const meta = doc.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const y = (meta as Record<string, unknown>).publicationYear;
    if (typeof y === "number") return y;
    if (typeof y === "string" && /^\d{4}$/.test(y)) return Number(y);
  }
  return null;
}

function getDocPeriod(doc: DocItem): PeriodCode | null {
  const meta = doc.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const period = (meta as Record<string, unknown>).primaryPeriod;
    if (typeof period === "string" && period in PERIODS) return period as PeriodCode;
  }
  return null;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function DocumentsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    const load = async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "30",
        });
        if (statusFilter !== "all") params.set("status", statusFilter);
        const res = await fetch(`/api/documents?${params}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as DocsResponse;
        if (!mounted) return;
        setDocs(data.documents);
        setTotalPages(data.pagination.totalPages);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError" && mounted) {
          setError((e as Error).message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    // Auto-refresh mientras haya PROCESSING.
    const interval = setInterval(() => {
      if (docs.some((d) => d.status === "PROCESSING")) load();
    }, 5000);

    return () => {
      mounted = false;
      ctrl.abort();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  const filtered = useMemo(() => {
    if (!search.trim()) return docs;
    const q = normalize(search.trim());
    return docs.filter((d) => {
      const title = normalize(getDocTitle(d));
      const author = normalize(getDocAuthor(d) ?? "");
      return title.includes(q) || author.includes(q);
    });
  }, [docs, search]);

  const counts = useMemo(() => {
    return {
      all: docs.length,
      READY: docs.filter((d) => d.status === "READY").length,
      PROCESSING: docs.filter((d) => d.status === "PROCESSING").length,
      ERROR: docs.filter((d) => d.status === "ERROR").length,
    };
  }, [docs]);

  return (
    <div className="fade-up" data-screen-label="Documents">
      <PageHeader
        label={`Repositorio · ${docs.length} obras`}
        title="Documentos"
        italic="del corpus"
        subtitle="Cada PDF es procesado por hash SHA-256, chunkeado y vectorizado con Cohere v4. Las obras enriquecidas reciben metadata histórica."
        action={
          <button
            type="button"
            onClick={() => router.push("/admin/upload")}
            style={primaryBtn}
          >
            Cargar PDFs →
          </button>
        }
      />

      <hr className="hairline" style={{ margin: "0 56px" }} />

      <section
        style={{
          padding: "20px 56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
          maxWidth: 1320,
        }}
      >
        <FilterTabs<StatusFilter>
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: `Todos · ${counts.all}` },
            { value: "READY", label: `Listos · ${counts.READY}` },
            { value: "PROCESSING", label: `Procesando · ${counts.PROCESSING}` },
            { value: "ERROR", label: `Error · ${counts.ERROR}` },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar título, autor…" />
      </section>

      <section style={{ padding: "0 56px 48px", maxWidth: 1320 }}>
        {error && (
          <div
            style={{
              padding: "12px 16px",
              border: "1px solid var(--danger)",
              color: "var(--danger)",
              fontSize: 13,
              marginBottom: 16,
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        <DocTable docs={filtered} loading={loading} onOpen={(id) => router.push(`/admin/documents/${id}`)} />

        {!loading && filtered.length === 0 && (
          <EmptyState
            title="Sin resultados"
            hint="Ajusta los filtros o sube un PDF nuevo."
            action={
              <button
                type="button"
                onClick={() => router.push("/admin/upload")}
                style={primaryBtn}
              >
                Cargar PDFs →
              </button>
            }
          />
        )}

        {totalPages > 1 && (
          <div
            style={{
              marginTop: 32,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--fg-muted)",
            }}
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                appearance: "none",
                background: "transparent",
                border: "1px solid var(--line-strong)",
                padding: "4px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-muted)",
                cursor: page <= 1 ? "default" : "pointer",
                opacity: page <= 1 ? 0.4 : 1,
              }}
            >
              ←
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                appearance: "none",
                background: "transparent",
                border: "1px solid var(--line-strong)",
                padding: "4px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--fg-muted)",
                cursor: page >= totalPages ? "default" : "pointer",
                opacity: page >= totalPages ? 0.4 : 1,
              }}
            >
              →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function DocTable({
  docs,
  loading,
  onOpen,
}: {
  docs: DocItem[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "44px 1fr 180px 130px 110px 90px",
          gap: 16,
          padding: "12px 0 14px",
          borderBottom: "1px solid var(--line-strong)",
          alignItems: "baseline",
        }}
      >
        <div className="label">#</div>
        <div className="label">Título / Autor</div>
        <div className="label">Período</div>
        <div className="label">Estado</div>
        <div className="label" style={{ textAlign: "right" }}>
          Chunks
        </div>
        <div className="label" style={{ textAlign: "right" }}>
          Tamaño
        </div>
      </div>
      {loading && docs.length === 0 && (
        <div style={{ padding: "32px 0" }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: "20px 0",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div className="shimmer-line" style={{ height: 16, width: "70%", marginBottom: 8 }} />
              <div className="shimmer-line" style={{ height: 10, width: "40%" }} />
            </div>
          ))}
        </div>
      )}
      {docs.map((d, i) => {
        const period = getDocPeriod(d);
        const author = getDocAuthor(d);
        const year = getDocYear(d);
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onOpen(d.id)}
            style={{
              width: "100%",
              appearance: "none",
              background: "transparent",
              border: 0,
              borderBottom: "1px solid var(--line)",
              padding: "16px 0",
              cursor: "pointer",
              textAlign: "left",
              display: "grid",
              gridTemplateColumns: "44px 1fr 180px 130px 110px 90px",
              gap: 16,
              alignItems: "baseline",
              transition: "background 120ms var(--ease-out-custom)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <div className="mono" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                className="serif"
                style={{
                  fontSize: 16,
                  color: "var(--fg)",
                  lineHeight: 1.25,
                  letterSpacing: "-0.005em",
                }}
              >
                {getDocTitle(d)}
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>
                {author ? `${author} · ` : ""}
                {year ? `${year} · ` : ""}
                {d.pageCount} pp
                {d.enriched && (
                  <span style={{ marginLeft: 8, color: "var(--accent)" }}>· enriquecido</span>
                )}
              </div>
            </div>
            {period ? <PeriodTag code={period} size="sm" /> : <span />}
            <DocStatusBadge status={d.status} />
            <div
              className="mono num"
              style={{ fontSize: 12.5, color: "var(--fg)", textAlign: "right" }}
            >
              {d._count.chunks ? d._count.chunks.toLocaleString("es-CO") : "—"}
            </div>
            <div
              className="mono"
              style={{ fontSize: 11.5, color: "var(--fg-muted)", textAlign: "right" }}
            >
              {formatSize(d.fileSize)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DocStatusBadge({ status }: { status: DocStatus }) {
  const map: Record<
    DocStatus,
    { kind: "success" | "warning" | "danger" | "muted"; label: string }
  > = {
    READY: { kind: "success", label: "Listo" },
    PROCESSING: { kind: "warning", label: "Procesando" },
    PENDING: { kind: "muted", label: "Pendiente" },
    ERROR: { kind: "danger", label: "Error" },
  };
  const cfg = map[status];
  return <StatusDot kind={cfg.kind} label={cfg.label} />;
}
