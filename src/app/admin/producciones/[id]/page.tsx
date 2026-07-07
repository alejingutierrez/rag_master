"use client";

import { Fragment, use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PeriodTag, ghostBtn, linkBtn } from "@/components/editorial";
import { Cita } from "@/components/editorial/cita";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/components/ui";
import { PERIODS, type PeriodCode } from "@/lib/design-tokens";
import { getAtelierFormat } from "@/lib/atelier-formats";
import { TIPO_LABELS, ESCALA_LABELS } from "@/lib/questions-config";
import { deriveSeo, normalizeSeo, type DeliverableSeo } from "@/lib/seo";

interface ChunkUsage {
  id: string;
  documentId: string;
  documentFilename?: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  content: string;
}

interface DeliverableDetail {
  id: string;
  questionId?: string | null;
  templateId: string;
  answer?: string | null;
  modelUsed?: string | null;
  status: "PENDING" | "GENERATING" | "COMPLETE" | "ERROR";
  source?: string | null;
  userQuestion?: string | null;
  createdAt: string;
  updatedAt: string;
  chunksUsed?: ChunkUsage[];
  question?: {
    id: string;
    pregunta: string;
    periodoCode: string;
    periodoNombre: string;
    periodoRango?: string;
    categoriaCode?: string;
    categoriaNombre?: string;
    document?: { id: string; filename: string };
  } | null;
  metadata?: Record<string, unknown> | null;
  structuredData?: StructuredLite | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  imageUrl?: string | null;
  imageKey?: string | null;
}

interface StructuredLite {
  typology?: "hecho" | "epoca" | "entidad" | "pregunta";
  slug?: string;
  titulo?: string;
  tipo?: string;
}

/** Espejo de ImageMeta (lib/atelier/image.ts) — lo que persiste metadata.image. */
interface ImageMetaLite {
  status?: "generando" | "ok" | "sin_referencias" | "error";
  at?: string;
  modelo?: string;
  ancla?: "documental" | "parcial" | "solo-texto";
  acento?: { color?: "rojo" | "amarillo" | "azul"; objetivo?: string; razon?: string };
  encuadre?: string;
  escena?: {
    modo?: string;
    referenciaPrincipal?: { indice?: number; titulo?: string; pagina?: string; url?: string; fuente?: string; score?: number };
    ancla?: string;
    anclaEn?: string;
    movimientoCreativo?: string;
    restricciones?: string[];
    advertencias?: string[];
  };
  referencias?: { titulo?: string; url?: string; pagina?: string; fuente?: string; score?: number }[];
  relevantes?: number;
  candidatos?: number;
  usables?: number;
  intentos?: number;
  error?: string;
}

const ACCENT_HEX: Record<string, string> = {
  rojo: "#8c1d18",
  amarillo: "#a87b00",
  azul: "#1f4e79",
};

const ANCLA_LABELS: Record<string, string> = {
  documental: "Ancla documental",
  parcial: "Ancla parcial",
  "solo-texto": "Ancla: solo texto",
};

const ENCUADRE_LABELS: Record<string, string> = {
  "plano-general": "Plano general",
  "plano-medio": "Plano medio",
  detalle: "Detalle",
  contrapicado: "Contrapicado",
  cenital: "Cenital",
  interior: "Interior",
  retrato: "Retrato",
};

const TYPOLOGY_SEG: Record<string, string> = {
  hecho: "hechos",
  epoca: "epocas",
  entidad: "entidades",
  pregunta: "preguntas",
};
const TYPOLOGY_LABEL: Record<string, string> = {
  hecho: "Hecho",
  epoca: "Época",
  entidad: "Entidad",
  pregunta: "Pregunta",
};

/** Ruta pública de una pieza: ficha de tipología o ensayo. */
function publicHref(d: DeliverableDetail): string {
  const s = d.structuredData;
  if (s?.typology && s.slug && TYPOLOGY_SEG[s.typology]) {
    return `/${TYPOLOGY_SEG[s.typology]}/${s.slug}`;
  }
  return `/ensayos/${d.id}`;
}

interface AtelierConfidence {
  score: number;
  label: "alta" | "media" | "baja";
  rationale?: string;
  factors?: { name: string; value: number }[];
  documentosUnicos?: number;
}
interface AtelierSection {
  seccion: string;
  sourceRefs: { chunkId: string; documentFilename?: string; pageNumber?: number }[];
  claimIds?: string[];
}
interface AtelierTaxonomy {
  periodoCode?: string;
  periodoNombre?: string;
  categoriaNombre?: string;
  subcategoriaNombre?: string;
  yearPrincipal?: number | null;
  yearsSecondary?: number[];
  entidadesPersonas?: string[];
  entidadesLugares?: string[];
  entidadesConceptos?: string[];
  tipoPregunta?: string | null;
  escalaGeografica?: string | null;
  clusterTematico?: string | null;
}
interface AtelierMeta {
  confidenceIndex?: AtelierConfidence;
  criticalApparatus?: { fuentesPorSeccion?: AtelierSection[] };
  taxonomy?: AtelierTaxonomy;
  degraded?: string[];
}

function docLabel(c: ChunkUsage): string {
  if (c.documentFilename) return c.documentFilename.replace(/\.pdf$/i, "");
  return c.documentId.slice(0, 8);
}

function wordCount(s: string | null | undefined): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function citationCount(s: string | null | undefined): number {
  if (!s) return 0;
  const matches = s.match(/\[#?\d+\]/g);
  return matches ? matches.length : 0;
}

export default function ProduccionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DeliverableDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<ChunkUsage | null>(null);
  const [sourceFull, setSourceFull] = useState<{ id: string; content: string } | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [imaging, setImaging] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const imagePollRef = useRef<NodeJS.Timeout | null>(null);

  async function togglePublish() {
    if (!data) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/deliverables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !data.publishedAt }),
      });
      if (res.ok) {
        const { deliverable } = (await res.json()) as {
          deliverable: { publishedAt: string | null; publishedBy: string | null; structuredData: StructuredLite | null };
        };
        setData((d) =>
          d
            ? {
                ...d,
                publishedAt: deliverable.publishedAt,
                publishedBy: deliverable.publishedBy,
                structuredData: deliverable.structuredData ?? d.structuredData,
              }
            : d,
        );
      }
    } finally {
      setPublishing(false);
    }
  }

  /**
   * El endpoint responde 202 de inmediato y el pipeline (referencias → gpt-image)
   * corre en background: aquí solo se arranca y se hace polling de metadata.image
   * hasta que deje de estar "generando" (o venza el plazo).
   */
  const startImagePolling = useCallback(() => {
    if (imagePollRef.current) clearInterval(imagePollRef.current);
    const deadline = Date.now() + 12 * 60 * 1000;
    imagePollRef.current = setInterval(async () => {
      const fresh = (await fetch(`/api/deliverables/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) as DeliverableDetail | null;
      if (!fresh) return;
      setData(fresh);
      const st = (fresh.metadata as { image?: ImageMetaLite } | null)?.image?.status;
      if (st !== "generando" || Date.now() > deadline) {
        if (imagePollRef.current) clearInterval(imagePollRef.current);
        imagePollRef.current = null;
      }
    }, 4000);
  }, [id]);

  async function generateImage() {
    if (!data) return;
    setImaging(true);
    setImageError(null);
    try {
      const res = await fetch(`/api/deliverables/${id}/generate-image`, { method: "POST" });
      if (!res.ok && res.status !== 202) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setImageError(err.error ?? `HTTP ${res.status}`);
      }
      // Refleja el estado "generando" de inmediato y arranca el polling.
      const fresh = await fetch(`/api/deliverables/${id}`).then((r) => (r.ok ? r.json() : null));
      if (fresh) setData(fresh as DeliverableDetail);
      startImagePolling();
    } finally {
      setImaging(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    const load = async () => {
      try {
        const res = await fetch(`/api/deliverables/${id}`, { signal: ctrl.signal });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
        }
        const d = (await res.json()) as DeliverableDetail;
        if (!mounted) return;
        setData(d);
        setError(null);
        if (d.status !== "GENERATING" && d.status !== "PENDING") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
        }
        // Si la portada quedó "generando" (p. ej. tras recargar la página),
        // retoma el polling de metadata.image.
        const imgSt = (d.metadata as { image?: ImageMetaLite } | null)?.image?.status;
        if (imgSt === "generando" && !imagePollRef.current) startImagePolling();
      } catch (e) {
        if ((e as Error).name !== "AbortError" && mounted) {
          setError((e as Error).message);
        }
      }
    };

    load();
    pollRef.current = setInterval(load, 3000);

    return () => {
      mounted = false;
      ctrl.abort();
      if (pollRef.current) clearInterval(pollRef.current);
      if (imagePollRef.current) clearInterval(imagePollRef.current);
    };
  }, [id, startImagePolling]);

  // El snippet en chunksUsed va recortado (~400 chars). Al abrir el modal,
  // pedimos el contenido íntegro al endpoint read-only; si falla, queda el snippet.
  useEffect(() => {
    if (!activeSource?.id) {
      setSourceFull(null);
      return;
    }
    const ctrl = new AbortController();
    setSourceLoading(true);
    setSourceFull(null);
    fetch(`/api/chunks/${activeSource.id}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { id: string; content: string } | null) => {
        if (c?.content) setSourceFull({ id: c.id, content: c.content });
      })
      .catch(() => {
        /* fallback al snippet almacenado */
      })
      .finally(() => setSourceLoading(false));
    return () => ctrl.abort();
  }, [activeSource?.id]);

  if (error) {
    return (
      <div className="fade-up" style={{ padding: "96px 56px", maxWidth: 760 }}>
        <div className="label" style={{ marginBottom: 16 }}>
          Error
        </div>
        <h1 className="display" style={{ fontSize: 56, margin: 0, color: "var(--fg)" }}>
          {error}
        </h1>
        <button
          type="button"
          onClick={() => router.push("/admin/producciones")}
          style={{ ...ghostBtn, marginTop: 28 }}
        >
          ← Volver a producciones
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fade-up" style={{ padding: "96px 56px", maxWidth: 760 }}>
        <div className="shimmer-line" style={{ height: 16, width: 200, marginBottom: 24 }} />
        <div className="shimmer-line" style={{ height: 56, width: "80%", marginBottom: 16 }} />
        <div className="shimmer-line" style={{ height: 56, width: "60%" }} />
      </div>
    );
  }

  const periodCode = data.question?.periodoCode as PeriodCode | undefined;
  const period = periodCode && periodCode in PERIODS ? PERIODS[periodCode] : null;
  const isAtelier = data.source === "atelier";
  const atelier = isAtelier
    ? ((data.metadata as { atelier?: AtelierMeta } | null)?.atelier ?? null)
    : null;
  const formatLabel = getAtelierFormat(data.templateId)?.name ?? data.templateId;
  const hasSections = !!atelier?.criticalApparatus?.fuentesPorSeccion?.length;
  const title = data.question?.pregunta ?? data.userQuestion ?? "Producción";
  const words = wordCount(data.answer);
  const cites = citationCount(data.answer);
  const isGenerating = data.status === "GENERATING" || data.status === "PENDING";
  const created = new Date(data.createdAt).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="fade-up"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 320px",
        minHeight: "calc(100vh - 61px)",
      }}
      data-screen-label="ProduccionDetail"
    >
      <article
        style={{
          padding: "32px 80px 120px",
          maxWidth: 900,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/admin/producciones")}
          style={{ ...linkBtn, fontSize: 12, marginBottom: 32 }}
        >
          ← Producciones
        </button>

        <header style={{ marginBottom: 52 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 32,
              flexWrap: "wrap",
            }}
          >
            {periodCode && <PeriodTag code={periodCode} showName />}
            <span style={{ color: "var(--fg-dim)" }}>·</span>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--fg-muted)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {formatLabel} · {words.toLocaleString("es-CO")} palabras
              {isAtelier && atelier?.confidenceIndex
                ? ` · confianza ${atelier.confidenceIndex.score} (${atelier.confidenceIndex.label})`
                : ` · ${cites} citas`}
            </div>
          </div>

          <h1
            className="display"
            style={{
              fontSize: "clamp(40px, 5.5vw, 72px)",
              margin: 0,
              lineHeight: 1.05,
              color: "var(--fg)",
              letterSpacing: "-0.03em",
            }}
          >
            {title}
          </h1>

          {data.question?.categoriaNombre && (
            <p
              className="serif"
              style={{
                fontSize: 20,
                color: "var(--fg-muted)",
                margin: "24px 0 0",
                fontStyle: "italic",
                lineHeight: 1.5,
                maxWidth: 640,
              }}
            >
              {data.question.categoriaNombre}
              {period ? ` · ${period.yearRange}` : ""}
            </p>
          )}

          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--fg-faint)",
              marginTop: 28,
              letterSpacing: "0.02em",
            }}
          >
            Alejandro Gutiérrez · {created} · {data.chunksUsed?.length ?? 0} fuentes
          </div>
        </header>

        <hr className="hairline" style={{ marginBottom: 48 }} />

        {isGenerating && (
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
              Generando producción…
            </span>
          </div>
        )}

        {!isGenerating && data.answer && (
          <div className="prose">
            <AnswerRender
              markdown={data.answer}
              chunks={data.chunksUsed ?? []}
              onCite={setActiveSource}
            />
          </div>
        )}
      </article>

      {/* Aparato crítico */}
      <aside
        style={{
          borderLeft: "1px solid var(--line)",
          background: "var(--bg)",
          padding: "80px 32px 32px",
          position: "sticky",
          top: 61,
          height: "calc(100vh - 61px)",
          overflowY: "auto",
        }}
        aria-label="Aparato crítico"
      >
        {isAtelier && !isGenerating && (
          <PublishPanel
            data={data}
            publishing={publishing}
            imaging={
              imaging ||
              (data.metadata as { image?: ImageMetaLite } | null)?.image?.status === "generando"
            }
            imageError={imageError}
            onToggle={togglePublish}
            onGenerateImage={generateImage}
          />
        )}

        {isAtelier && !isGenerating && (
          <SeoPanel
            data={data}
            onSaved={(seo) =>
              setData((d) => (d ? { ...d, metadata: { ...(d.metadata ?? {}), seo } } : d))
            }
          />
        )}

        <div className="label" style={{ marginBottom: 8 }}>
          Aparato crítico
        </div>
        {isAtelier && atelier?.confidenceIndex && (
          <ConfidencePanel ci={atelier.confidenceIndex} degraded={atelier.degraded} />
        )}

        {isAtelier && atelier?.taxonomy && <TaxonomyPanel tax={atelier.taxonomy} />}

        <h3
          className="display"
          style={{
            fontSize: 22,
            margin: "0 0 24px",
            color: "var(--fg)",
            lineHeight: 1.1,
          }}
        >
          {hasSections ? "Fuentes por sección" : "Fuentes citadas"}
        </h3>

        {hasSections ? (
          <AtelierSections
            sections={atelier!.criticalApparatus!.fuentesPorSeccion!}
            chunks={data.chunksUsed ?? []}
            onPick={setActiveSource}
          />
        ) : (
          (data.chunksUsed ?? []).map((c, i) => (
            <SourceButton key={c.id ?? i} c={c} index={i} onPick={setActiveSource} />
          ))
        )}

        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <button
            type="button"
            style={ghostBtn}
            onClick={() => {
              if (data.answer) {
                void navigator.clipboard.writeText(data.answer);
              }
            }}
          >
            Copiar markdown
          </button>
          <button
            type="button"
            style={ghostBtn}
            onClick={() => window.print()}
          >
            Imprimir / PDF
          </button>
        </div>
      </aside>

      <Dialog
        open={!!activeSource}
        onOpenChange={(open) => {
          if (!open) setActiveSource(null);
        }}
      >
        <DialogContent size="lg">
          {activeSource && (
            <>
              <DialogHeader>
                <DialogTitle>{docLabel(activeSource)}</DialogTitle>
                <DialogDescription>
                  p. {activeSource.pageNumber} · fragmento #{activeSource.chunkIndex} · similitud{" "}
                  {(activeSource.similarity * 100).toFixed(0)}%
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                {sourceLoading && sourceFull?.id !== activeSource.id && (
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--fg-faint)",
                      marginBottom: 12,
                      letterSpacing: "0.04em",
                    }}
                  >
                    Cargando fragmento completo…
                  </div>
                )}
                <div
                  className="serif"
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: "var(--fg)",
                  }}
                >
                  {sourceFull?.id === activeSource.id
                    ? sourceFull.content
                    : activeSource.content}
                </div>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PublishPanel({
  data,
  publishing,
  imaging,
  imageError,
  onToggle,
  onGenerateImage,
}: {
  data: DeliverableDetail;
  publishing: boolean;
  imaging: boolean;
  imageError: string | null;
  onToggle: () => void;
  onGenerateImage: () => void;
}) {
  const published = !!data.publishedAt;
  const s = data.structuredData;
  const typLabel = s?.typology ? TYPOLOGY_LABEL[s.typology] : null;
  const href = publicHref(data);
  const pubDate = data.publishedAt
    ? new Date(data.publishedAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
    : null;
  const imageMeta = (data.metadata as { image?: ImageMetaLite } | null)?.image;

  return (
    <div
      style={{
        marginBottom: 28,
        paddingBottom: 24,
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: published ? "var(--success)" : "var(--fg-dim)",
          }}
        />
        <span
          className="mono"
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: published ? "var(--success)" : "var(--fg-muted)",
          }}
        >
          {published ? "Publicado" : "Borrador"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <MiniTag>{typLabel ?? "Ensayo"}</MiniTag>
        {s?.slug && <MiniTag>/{s.slug}</MiniTag>}
      </div>

      {data.imageUrl && (
        <div style={{ marginBottom: 14 }}>
          {/* La portada lleva UN acento de color con significado: nunca filtrarla a gris. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.imageUrl}
            alt={imageMeta?.acento?.objetivo ? `Portada — acento en ${imageMeta.acento.objetivo}` : "Portada"}
            style={{
              width: "100%",
              aspectRatio: s?.typology === "entidad" && s?.tipo === "Persona" ? "9 / 16" : "16 / 9",
              objectFit: "cover",
              border: "1px solid var(--line)",
              maxHeight: 260,
            }}
          />
        </div>
      )}

      {imageMeta && <ImageDirectionPanel meta={imageMeta} />}

      {(imageError || imageMeta?.status === "sin_referencias" || imageMeta?.status === "error") && (
        <div
          style={{
            border: "1px solid var(--line-strong)",
            borderLeft: "3px solid var(--danger)",
            padding: "10px 12px",
            marginBottom: 14,
            fontSize: 12,
            color: "var(--fg-muted)",
            lineHeight: 1.5,
          }}
        >
          {imageMeta?.status === "sin_referencias" && !imageError ? (
            <>
              Sin imagen: el buscador halló {imageMeta.relevantes ?? 0} referencias relevantes de las 5
              mínimas ({imageMeta.candidatos ?? 0} candidatas). Reintenta, o considera afinar el título de la
              ficha.
            </>
          ) : (
            (imageError ?? imageMeta?.error ?? "La generación falló.")
          )}
        </div>
      )}

      {/* Nota informativa (no error): la imagen SÍ se generó, pero con ancla
          documental reducida. Importa para el rigor: se hace explícito. */}
      {!imageError &&
        imageMeta?.status === "ok" &&
        (imageMeta.ancla === "parcial" || imageMeta.ancla === "solo-texto") && (
          <div
            style={{
              border: "1px solid var(--line-strong)",
              borderLeft: "3px solid #a87b00",
              padding: "10px 12px",
              marginBottom: 14,
              fontSize: 12,
              color: "var(--fg-muted)",
              lineHeight: 1.5,
            }}
          >
            {imageMeta.ancla === "parcial" ? (
              <>
                Ancla documental parcial: {imageMeta.relevantes ?? 0} de 5 referencias relevantes (
                {imageMeta.candidatos ?? 0} candidatas). La imagen se apoyó en las referencias
                disponibles y en el texto de la pieza. Para ancla plena, regenera o afina el título de
                la ficha.
              </>
            ) : (
              <>
                Sin referencias visuales suficientes ({imageMeta.candidatos ?? 0} candidatas,{" "}
                {imageMeta.relevantes ?? 0} relevantes): la imagen se generó a partir del texto de la
                pieza, sin ancla documental. Regenera o afina el título para conseguir referencias
                reales.
              </>
            )}
          </div>
        )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          onClick={onToggle}
          disabled={publishing}
          style={{
            appearance: "none",
            padding: "9px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: publishing ? "wait" : "pointer",
            background: published ? "transparent" : "var(--fg)",
            color: published ? "var(--fg-muted)" : "var(--bg)",
            border: published ? "1px solid var(--line-strong)" : "none",
          }}
        >
          {publishing ? "…" : published ? "Despublicar" : "Publicar"}
        </button>

        <button
          type="button"
          onClick={onGenerateImage}
          disabled={imaging}
          style={{ ...ghostBtn, cursor: imaging ? "wait" : "pointer" }}
        >
          {imaging
            ? "Buscando referencias y generando…"
            : data.imageUrl
              ? "Regenerar imagen"
              : "Generar imagen"}
        </button>

        {published && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            style={{ ...ghostBtn, textAlign: "center", textDecoration: "none" }}
          >
            Ver publicado ↗
          </a>
        )}
      </div>

      {published && pubDate && (
        <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 10 }}>
          Publicado {pubDate}
          {data.publishedBy ? ` · ${data.publishedBy}` : ""}
        </div>
      )}
    </div>
  );
}

/** Dirección de arte de la portada: acento, encuadre y las referencias reales usadas. */
const seoLbl: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--fg-subtle)",
  margin: "10px 0 4px",
};
const seoInput: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line-strong)",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--fg)",
};
const seoCount: React.CSSProperties = { fontSize: 11, textAlign: "right", marginTop: 2 };

/**
 * Panel de SEO editable. El Taller ya escribe metadata.seo; aquí el curador puede
 * ajustar meta título / descripción / keywords antes de publicar. Si la pieza aún
 * no tiene SEO, se muestra el sugerido (derivado del título + taxonomía).
 */
function SeoPanel({
  data,
  onSaved,
}: {
  data: DeliverableDetail;
  onSaved: (seo: DeliverableSeo) => void;
}) {
  const suggested = (): DeliverableSeo =>
    deriveSeo({
      titulo: data.structuredData?.titulo ?? data.question?.pregunta ?? data.userQuestion ?? "",
      answer: data.answer,
      taxonomy: (data.metadata as { atelier?: { taxonomy?: unknown } } | null)?.atelier
        ?.taxonomy as Parameters<typeof deriveSeo>[0]["taxonomy"],
    });

  const initial = normalizeSeo((data.metadata as { seo?: unknown } | null)?.seo) ?? suggested();

  const [metaTitle, setMetaTitle] = useState(initial.metaTitle);
  const [metaDescription, setMetaDescription] = useState(initial.metaDescription);
  const [keywords, setKeywords] = useState(initial.keywords.join(", "));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const seo = {
        metaTitle: metaTitle.trim(),
        metaDescription: metaDescription.trim(),
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      };
      const res = await fetch(`/api/deliverables/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seo }),
      });
      if (res.ok) {
        const { deliverable } = (await res.json()) as {
          deliverable: { metadata?: { seo?: DeliverableSeo } | null };
        };
        onSaved(deliverable.metadata?.seo ?? (seo as DeliverableSeo));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  function useSuggested() {
    const s = suggested();
    setMetaTitle(s.metaTitle);
    setMetaDescription(s.metaDescription);
    setKeywords(s.keywords.join(", "));
  }

  const titleOver = metaTitle.length > 60;
  const descOver = metaDescription.length > 155;

  return (
    <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--line)" }}>
      <div className="label" style={{ marginBottom: 10 }}>
        SEO
      </div>

      <label style={seoLbl}>Meta título</label>
      <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} style={seoInput} />
      <div style={{ ...seoCount, color: titleOver ? "var(--danger)" : "var(--fg-subtle)" }}>
        {metaTitle.length}/60
      </div>

      <label style={seoLbl}>Meta descripción</label>
      <textarea
        value={metaDescription}
        onChange={(e) => setMetaDescription(e.target.value)}
        rows={3}
        style={{ ...seoInput, resize: "vertical" }}
      />
      <div style={{ ...seoCount, color: descOver ? "var(--danger)" : "var(--fg-subtle)" }}>
        {metaDescription.length}/155
      </div>

      <label style={seoLbl}>Keywords (separadas por coma)</label>
      <input value={keywords} onChange={(e) => setKeywords(e.target.value)} style={seoInput} />

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14 }}>
        <button
          onClick={save}
          disabled={saving || !metaTitle.trim() || !metaDescription.trim()}
          style={ghostBtn}
        >
          {saving ? "Guardando…" : "Guardar SEO"}
        </button>
        <button onClick={useSuggested} style={{ ...linkBtn, fontSize: 12 }}>
          Usar sugerido
        </button>
        {saved && <span style={{ fontSize: 12, color: "var(--success)" }}>Guardado ✓</span>}
      </div>
    </div>
  );
}

function ImageDirectionPanel({ meta }: { meta: ImageMetaLite }) {
  const [showRefs, setShowRefs] = useState(false);
  const color = meta.acento?.color;
  const refs = meta.referencias ?? [];
  const scene = meta.escena;
  if (meta.status !== "ok" && refs.length === 0 && !meta.acento) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      {scene?.ancla && (
        <div
          style={{
            border: "1px solid var(--line)",
            padding: "8px 10px",
            marginBottom: 8,
            fontSize: 11.5,
            lineHeight: 1.45,
            color: "var(--fg-muted)",
          }}
        >
          <div className="mono" style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Escena ancla
            {scene.modo ? ` · ${scene.modo}` : ""}
          </div>
          <div style={{ color: "var(--fg)" }}>{scene.ancla}</div>
          {scene.referenciaPrincipal && (
            <a
              href={scene.referenciaPrincipal.pagina ?? scene.referenciaPrincipal.url}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-block", marginTop: 5, color: "var(--fg-muted)", textDecoration: "none" }}
            >
              Ref #{scene.referenciaPrincipal.indice}: {scene.referenciaPrincipal.titulo ?? "referencia"} ↗
            </a>
          )}
          {scene.advertencias?.length ? (
            <div className="mono" style={{ marginTop: 5, fontSize: 9.5, color: "#a87b00" }}>
              Ajustes: {scene.advertencias.join(" · ")}
            </div>
          ) : null}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {color && (
          <span
            className="mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              padding: "3px 8px",
              border: "1px solid var(--line-strong)",
              borderRadius: 4,
              color: "var(--fg-muted)",
            }}
            title={meta.acento?.razon}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: ACCENT_HEX[color] ?? "var(--fg-dim)",
              }}
            />
            {meta.acento?.objetivo ?? color}
          </span>
        )}
        {meta.encuadre && <MiniTag>{ENCUADRE_LABELS[meta.encuadre] ?? meta.encuadre}</MiniTag>}
        {meta.ancla && <MiniTag>{ANCLA_LABELS[meta.ancla] ?? meta.ancla}</MiniTag>}
        {refs.length > 0 && (
          <button
            type="button"
            onClick={() => setShowRefs((v) => !v)}
            className="mono"
            style={{
              appearance: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 10,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              padding: "3px 8px",
              border: "1px solid var(--line-strong)",
              borderRadius: 4,
              color: "var(--fg-muted)",
            }}
          >
            {refs.length} referencias {showRefs ? "▴" : "▾"}
          </button>
        )}
      </div>

      {showRefs && refs.length > 0 && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
          {refs.map((r, i) => (
            <li
              key={i}
              style={{
                padding: "7px 0",
                borderTop: "1px solid var(--line)",
                fontSize: 11.5,
                lineHeight: 1.4,
              }}
            >
              <a
                href={r.pagina ?? r.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--fg)", textDecoration: "none" }}
              >
                {r.titulo || r.url || "referencia"} ↗
              </a>
              <span className="mono" style={{ fontSize: 9.5, color: "var(--fg-faint)", marginLeft: 6 }}>
                {r.fuente}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceButton({
  c,
  index,
  onPick,
}: {
  c: ChunkUsage;
  index: number;
  onPick: (c: ChunkUsage) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(c)}
      title="Ver fuente completa"
      style={{
        width: "100%",
        appearance: "none",
        background: "transparent",
        border: 0,
        borderTop: "1px solid var(--line)",
        padding: "16px 0",
        cursor: "pointer",
        textAlign: "left",
        display: "grid",
        gridTemplateColumns: "20px 1fr",
        gap: 12,
        alignItems: "baseline",
        transition: "opacity 120ms var(--ease-out-custom)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.6")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      <span className="mono" style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 500 }}>
        {String(index + 1).padStart(2, "0")}
      </span>
      <div>
        <div
          className="serif"
          style={{ fontSize: 14.5, color: "var(--fg)", lineHeight: 1.3, letterSpacing: "-0.005em" }}
        >
          {docLabel(c)}
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-subtle)", marginTop: 4 }}>
          p. {c.pageNumber} · sim {(c.similarity * 100).toFixed(0)}%
        </div>
      </div>
    </button>
  );
}

function MiniTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        fontSize: 10,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "3px 8px",
        border: "1px solid var(--line-strong)",
        borderRadius: 4,
        color: "var(--fg-muted)",
      }}
    >
      {children}
    </span>
  );
}

function TaxEntities({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          color: "var(--fg-faint)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label} · {items.length}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {items.map((it) => (
          <span
            key={it}
            style={{
              fontSize: 11.5,
              color: "var(--fg)",
              background: "var(--bg-muted)",
              padding: "2px 7px",
              borderRadius: 3,
              border: "1px solid var(--line)",
            }}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function TaxonomyPanel({ tax }: { tax: AtelierTaxonomy }) {
  const periodCode = tax.periodoCode as PeriodCode | undefined;
  const hasPeriod = !!periodCode && periodCode in PERIODS;
  const tipo = tax.tipoPregunta
    ? (TIPO_LABELS as Record<string, string>)[tax.tipoPregunta] ?? tax.tipoPregunta
    : null;
  const escala = tax.escalaGeografica
    ? (ESCALA_LABELS as Record<string, string>)[tax.escalaGeografica] ?? tax.escalaGeografica
    : null;
  const hasYears = tax.yearPrincipal != null || (tax.yearsSecondary?.length ?? 0) > 0;
  return (
    <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--line)" }}>
      <div className="label" style={{ marginBottom: 12 }}>
        Metadata analítica
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {hasPeriod && <PeriodTag code={periodCode!} size="sm" showName />}
        {tipo && <MiniTag>{tipo}</MiniTag>}
        {escala && <MiniTag>{escala}</MiniTag>}
      </div>

      {(tax.categoriaNombre || tax.subcategoriaNombre) && (
        <div style={{ fontSize: 12.5, color: "var(--fg)", marginBottom: 10 }}>
          {tax.categoriaNombre}
          {tax.subcategoriaNombre ? (
            <span style={{ color: "var(--fg-muted)" }}> · {tax.subcategoriaNombre}</span>
          ) : null}
        </div>
      )}

      {hasYears && (
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 12 }}>
          {tax.yearPrincipal != null && (
            <strong style={{ color: "var(--fg)" }}>{tax.yearPrincipal}</strong>
          )}
          {(tax.yearsSecondary?.length ?? 0) > 0 && ` · ${tax.yearsSecondary!.join(" · ")}`}
        </div>
      )}

      <TaxEntities label="Personas" items={tax.entidadesPersonas} />
      <TaxEntities label="Lugares" items={tax.entidadesLugares} />
      <TaxEntities label="Conceptos" items={tax.entidadesConceptos} />

      {tax.clusterTematico && (
        <div style={{ fontSize: 12, color: "var(--fg-muted)", fontStyle: "italic", marginTop: 8 }}>
          {tax.clusterTematico}
        </div>
      )}
    </div>
  );
}

function ConfidencePanel({ ci, degraded }: { ci: AtelierConfidence; degraded?: string[] }) {
  const color =
    ci.label === "alta" ? "var(--success)" : ci.label === "media" ? "var(--accent)" : "var(--danger)";
  return (
    <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <span className="display" style={{ fontSize: 34, color }}>
          {ci.score}
        </span>
        <span
          className="mono"
          style={{ fontSize: 11, color, textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          confianza {ci.label}
        </span>
      </div>
      {ci.rationale && (
        <p style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5, margin: 0 }}>
          {ci.rationale}
        </p>
      )}
      {ci.factors && ci.factors.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {ci.factors.map((f) => (
            <div key={f.name} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{f.name}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--fg-subtle)" }}>
                  {Math.round(f.value * 100)}%
                </span>
              </div>
              <div style={{ height: 3, background: "var(--line)", borderRadius: 2 }}>
                <div
                  style={{
                    width: `${Math.round(f.value * 100)}%`,
                    height: "100%",
                    background: "var(--accent)",
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {degraded && degraded.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--fg-faint)" }}>
          {degraded.map((d, i) => (
            <div key={i}>· {d}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function AtelierSections({
  sections,
  chunks,
  onPick,
}: {
  sections: AtelierSection[];
  chunks: ChunkUsage[];
  onPick: (c: ChunkUsage) => void;
}) {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  let running = 0;
  return (
    <>
      {sections.map((sec, si) => (
        <div key={si} style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 4, color: "var(--fg-muted)" }}>
            {sec.seccion}
          </div>
          {sec.sourceRefs.map((r) => {
            const c = byId.get(r.chunkId);
            if (!c) return null;
            return <SourceButton key={r.chunkId} c={c} index={running++} onPick={onPick} />;
          })}
        </div>
      ))}
    </>
  );
}

function AnswerRender({
  markdown,
  chunks,
  onCite,
}: {
  markdown: string;
  chunks: ChunkUsage[];
  onCite?: (chunk: ChunkUsage) => void;
}) {
  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];
  let blockquote: string[] = [];

  const flushBQ = (idx: number) => {
    if (blockquote.length) {
      blocks.push(
        <blockquote key={`bq-${idx}`}>
          {blockquote.map((l, j) => (
            <p key={j} style={{ margin: 0 }}>
              {renderInline(l, chunks, onCite)}
            </p>
          ))}
        </blockquote>,
      );
      blockquote = [];
    }
  };

  lines.forEach((line, idx) => {
    if (line.startsWith("> ")) {
      blockquote.push(line.slice(2));
      return;
    }
    flushBQ(idx);

    if (line.startsWith("# ")) {
      blocks.push(<h1 key={idx}>{renderInline(line.slice(2), chunks, onCite)}</h1>);
      return;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h2 key={idx}>{renderInline(line.slice(3), chunks, onCite)}</h2>);
      return;
    }
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={idx}>{renderInline(line.slice(4), chunks, onCite)}</h3>);
      return;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push(
        <li key={idx} style={{ marginLeft: 20 }}>
          {renderInline(line.slice(2), chunks, onCite)}
        </li>,
      );
      return;
    }
    if (/^\d+\.\s/.test(line)) {
      blocks.push(
        <li key={idx} style={{ marginLeft: 20 }}>
          {renderInline(line.replace(/^\d+\.\s/, ""), chunks, onCite)}
        </li>,
      );
      return;
    }
    if (line.trim() === "") {
      blocks.push(<div key={idx} style={{ height: 6 }} />);
      return;
    }
    blocks.push(<p key={idx}>{renderInline(line, chunks, onCite)}</p>);
  });

  flushBQ(lines.length);

  return <>{blocks}</>;
}

function renderInline(
  text: string,
  chunks: ChunkUsage[],
  onCite?: (chunk: ChunkUsage) => void,
) {
  const parts: React.ReactNode[] = [];
  let r = text;
  let k = 0;
  while (r.length) {
    const cMatch = r.match(/^\[#?(\d+)\]/);
    const bMatch = r.match(/^\*\*([^*]+)\*\*/);
    const iMatch = r.match(/^\*([^*]+)\*/);
    if (cMatch) {
      const n = parseInt(cMatch[1], 10);
      const chunk = chunks[n - 1];
      parts.push(
        <Cita
          key={k++}
          n={n}
          page={chunk?.pageNumber}
          doc={chunk ? docLabel(chunk) : undefined}
          onClick={chunk && onCite ? () => onCite(chunk) : undefined}
        />,
      );
      r = r.slice(cMatch[0].length);
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
