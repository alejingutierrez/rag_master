"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  SectionHeader,
  Stat,
  PeriodCoverageList,
  PeriodTag,
  primaryBtn,
  ghostBtn,
  linkBtn,
} from "@/components/editorial";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { getAtelierFormat } from "@/lib/atelier-formats";

interface DashboardData {
  stats: {
    documents: number;
    chunks: number;
    questions: number;
    conversations: number;
    deliverables: number;
    completedDeliverables: number;
    readyDocs: number;
    processingDocs: number;
    enrichedDocs: number;
  };
  deltas7d: { docs: number; questions: number; deliverables: number };
  recentDocuments: Array<{
    id: string;
    filename: string;
    status: string;
    pageCount: number;
    enriched: boolean;
    metadata?: Record<string, unknown> | null;
    _count: { chunks: number; questions: number };
    createdAt: string;
  }>;
  recentQuestions: Array<{
    id: string;
    pregunta: string;
    periodoCode: string;
    periodoNombre: string;
    categoriaCode: string;
    categoriaNombre: string;
    createdAt: string;
  }>;
  recentDeliverables: Array<{
    id: string;
    templateId: string;
    updatedAt: string;
    userQuestion?: string | null;
    question?: { pregunta: string; periodoCode: string } | null;
  }>;
  distribution: {
    documentsByPeriod: Array<{ code: string; count: number }>;
    chunksByPeriod: Array<{ code: string; count: number }>;
    questionsByPeriod: Array<{ code: string; count: number }>;
    questionsByPeriod30d: Array<{ code: string; count: number }>;
    categorias: Array<{ code: string; name: string; count: number }>;
  };
  activity: Array<{ day: string; docs: number; questions: number; deliverables: number }>;
}

function getDocTitle(doc: DashboardData["recentDocuments"][number]): string {
  const meta = doc.metadata as Record<string, unknown> | null | undefined;
  if (meta && typeof meta === "object") {
    const bookTitle = (meta as Record<string, unknown>).bookTitle;
    if (typeof bookTitle === "string" && bookTitle.trim()) return bookTitle.trim();
  }
  return doc.filename.replace(/\.pdf$/i, "");
}

function getDocAuthor(doc: DashboardData["recentDocuments"][number]): string | null {
  const meta = doc.metadata as Record<string, unknown> | null | undefined;
  if (meta && typeof meta === "object") {
    const author = (meta as Record<string, unknown>).author;
    if (typeof author === "string" && author.trim()) return author.trim();
  }
  return null;
}

function getDocPeriod(doc: DashboardData["recentDocuments"][number]): string | null {
  const meta = doc.metadata as Record<string, unknown> | null | undefined;
  if (meta && typeof meta === "object") {
    const period = (meta as Record<string, unknown>).primaryPeriod;
    if (typeof period === "string" && period in PERIODS) return period;
  }
  return null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/dashboard", { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: DashboardData) => {
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          console.error(e);
          setError((e as Error).message);
        }
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  return (
    <div className="fade-up" data-screen-label="Dashboard">
      {/* Hero */}
      <section
        style={{
          padding: "96px 56px 80px",
          maxWidth: 1320,
          position: "relative",
        }}
      >
        <div className="label" style={{ marginBottom: 20 }}>
          Plataforma de investigación{data ? ` · ${data.stats.documents} obras` : ""}
        </div>
        <h1
          className="display"
          style={{
            fontSize: "clamp(64px, 8.5vw, 132px)",
            margin: 0,
            color: "var(--fg)",
            maxWidth: 1100,
          }}
        >
          Una historia de Colombia{" "}
          <span className="display-italic" style={{ color: "var(--fg-muted)" }}>
            vectorizada,
          </span>{" "}
          citable, abierta a la consulta.
        </h1>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Link href="/admin/chat" style={{ ...primaryBtn, textDecoration: "none" }}>
            Hacer una consulta →
          </Link>
          <Link href="/admin/timeline" style={{ ...ghostBtn, textDecoration: "none" }}>
            Ver línea de tiempo
          </Link>
        </div>
        {error && (
          <div
            style={{
              marginTop: 32,
              padding: "12px 16px",
              border: "1px solid var(--danger)",
              color: "var(--danger)",
              fontSize: 13,
            }}
            role="alert"
          >
            No pudimos cargar los datos: {error}
          </div>
        )}
      </section>

      <hr className="hairline" style={{ margin: "0 56px" }} />

      {/* Stats */}
      <section style={{ padding: "56px 56px 72px", maxWidth: 1320 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
          }}
        >
          <div style={{ borderRight: "1px solid var(--line)", paddingRight: 32 }}>
            <Stat
              label="Documentos"
              value={loading || !data ? "—" : data.stats.documents}
              delta={data?.deltas7d.docs || undefined}
              hint={
                data
                  ? `${data.stats.readyDocs} listos · ${data.stats.enrichedDocs} enriquecidos`
                  : undefined
              }
            />
          </div>
          <div style={{ borderRight: "1px solid var(--line)", padding: "0 32px" }}>
            <Stat
              label="Fragmentos"
              value={loading || !data ? "—" : data.stats.chunks}
              hint="vectorizados · Cohere v4"
            />
          </div>
          <div style={{ borderRight: "1px solid var(--line)", padding: "0 32px" }}>
            <Stat
              label="Preguntas"
              value={loading || !data ? "—" : data.stats.questions}
              delta={data?.deltas7d.questions || undefined}
              hint="taxonomía de 15 períodos"
            />
          </div>
          <div style={{ paddingLeft: 32 }}>
            <Stat
              label="Producciones"
              value={loading || !data ? "—" : data.stats.completedDeliverables}
              delta={data?.deltas7d.deliverables || undefined}
              hint={data ? `de ${data.stats.deliverables} totales` : undefined}
            />
          </div>
        </div>
      </section>

      <hr className="hairline" style={{ margin: "0 56px" }} />

      {/* Two-column main area */}
      <section
        style={{
          padding: "72px 56px 96px",
          maxWidth: 1320,
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 80,
        }}
      >
        {/* LEFT — Cobertura por época */}
        <div>
          <SectionHeader
            index="01"
            title="Cobertura por época"
            caption="Preguntas por período histórico — clic para ver las de cada etapa"
            action={
              <Link href="/admin/timeline" style={{ ...linkBtn, textDecoration: "none" }}>
                línea de tiempo →
              </Link>
            }
          />
          <PeriodCoverageList
            data={data?.distribution.questionsByPeriod ?? []}
            onPeriod={(code) => {
              // Navegar a las preguntas filtradas por ese período.
              window.location.href = `/admin/questions?periodo=${code}`;
            }}
          />
        </div>

        {/* RIGHT — Recientes */}
        <div>
          <SectionHeader
            index="02"
            title="Recientes"
            caption="Últimos PDFs y producciones"
          />

          {/* Recent documents */}
          <div style={{ marginBottom: 56 }}>
            <div className="label" style={{ marginBottom: 14 }}>
              Documentos
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {!data || data.recentDocuments.length === 0 ? (
                <li
                  style={{
                    padding: "16px 0",
                    fontSize: 13,
                    color: "var(--fg-faint)",
                  }}
                >
                  Aún no hay documentos cargados.
                </li>
              ) : (
                data.recentDocuments.slice(0, 5).map((d, i) => {
                  const period = getDocPeriod(d);
                  const author = getDocAuthor(d);
                  return (
                    <li
                      key={d.id}
                      style={{ borderTop: i === 0 ? 0 : "1px solid var(--line)" }}
                    >
                      <Link
                        href={`/admin/documents/${d.id}`}
                        style={{
                          display: "grid",
                          width: "100%",
                          padding: "16px 0",
                          gridTemplateColumns: "1fr auto",
                          gap: 20,
                          alignItems: "baseline",
                          textDecoration: "none",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            className="serif"
                            style={{
                              fontSize: 18,
                              color: "var(--fg)",
                              lineHeight: 1.25,
                              letterSpacing: "-0.005em",
                            }}
                          >
                            {getDocTitle(d)}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--fg-muted)",
                              marginTop: 4,
                            }}
                          >
                            {author ? `${author} · ` : ""}
                            {d.pageCount} pp ·{" "}
                            {d._count.chunks.toLocaleString("es-CO")} fragmentos
                          </div>
                        </div>
                        {period && <PeriodTag code={period} size="sm" />}
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* Recent producciones */}
          <div>
            <div className="label" style={{ marginBottom: 14 }}>
              Producciones
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {!data || data.recentDeliverables.length === 0 ? (
                <li
                  style={{
                    padding: "16px 0",
                    fontSize: 13,
                    color: "var(--fg-faint)",
                  }}
                >
                  Aún no hay producciones generadas.
                </li>
              ) : (
                data.recentDeliverables.slice(0, 4).map((p, i) => {
                  const tpl = getAtelierFormat(p.templateId);
                  const title =
                    p.question?.pregunta ?? p.userQuestion ?? "(producción)";
                  const period = p.question?.periodoCode as PeriodCode | undefined;
                  return (
                    <li
                      key={p.id}
                      style={{ borderTop: i === 0 ? 0 : "1px solid var(--line)" }}
                    >
                      <Link
                        href={`/admin/producciones/${p.id}`}
                        style={{
                          display: "grid",
                          width: "100%",
                          padding: "16px 0",
                          gridTemplateColumns: "1fr auto",
                          gap: 20,
                          alignItems: "baseline",
                          textDecoration: "none",
                        }}
                      >
                        <div>
                          <div
                            className="mono"
                            style={{
                              fontSize: 10.5,
                              color: "var(--fg-faint)",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              marginBottom: 4,
                            }}
                          >
                            {tpl?.name ?? p.templateId}
                          </div>
                          <div
                            className="serif"
                            style={{
                              fontSize: 17,
                              color: "var(--fg)",
                              lineHeight: 1.25,
                              letterSpacing: "-0.005em",
                            }}
                          >
                            {title}
                          </div>
                        </div>
                        {period && period in PERIODS && (
                          <PeriodTag code={period} size="sm" />
                        )}
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
