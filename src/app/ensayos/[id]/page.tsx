import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { JsonLd } from "@/components/public/json-ld";
import { SourceApparatus } from "@/components/public/source-apparatus";
import { getEssay, getEntityLinker } from "@/lib/public-data";
import { renderProse } from "@/components/public/prose";
import { getPeriodColor } from "@/lib/design-tokens";
import { buildMetadata, articleJsonLd, breadcrumbJsonLd, jsonLdGraph } from "@/lib/seo";
import { TrackView } from "@/components/analytics/track-view";
import "@/components/public/article.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const essay = await getEssay(id);
  if (!essay) return { title: "Ensayo" };
  return buildMetadata({
    seo: essay.seo,
    path: `/ensayos/${essay.id}`,
    imageUrl: essay.imageUrl,
    publishedTime: essay.publishedAt,
    modifiedTime: essay.updatedAt,
    type: "article",
  });
}

export default async function EnsayoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const essay = await getEssay(id);
  if (!essay) notFound();
  const linker = await getEntityLinker();

  const dot = essay.periodCode ? getPeriodColor(essay.periodCode) : "var(--fg-dim)";

  const jsonLd = jsonLdGraph(
    articleJsonLd({
      path: `/ensayos/${essay.id}`,
      title: essay.title,
      description: essay.seo.metaDescription,
      imageUrl: essay.imageUrl,
      datePublished: essay.publishedAt,
      dateModified: essay.updatedAt,
      wordCount: essay.wordCount,
    }),
    breadcrumbJsonLd([
      { name: "Inicio", path: "/" },
      { name: "Archivo", path: "/archivo" },
      { name: essay.title, path: `/ensayos/${essay.id}` },
    ]),
  );

  return (
    <PublicShell>
      <JsonLd data={jsonLd} />
      <TrackView contentType="ensayo" itemId={essay.id} itemName={essay.title} />
      <div className="art-wrap">
        <div className="art-crumb">
          <Link href="/archivo">Archivo</Link> · {essay.formatName}
        </div>

        <header className="art-head">
          <div className="art-kick">
            <span className="art-dot" style={{ background: dot }} />
            <span className="art-klabel">
              {essay.formatName}
              {essay.yearRange ? ` · ${essay.yearRange}` : ""}
            </span>
          </div>
          <h1 className="art-title">{essay.title}</h1>
          {essay.categoria && <p className="art-stand">{essay.categoria}</p>}
          <div className="art-meta">
            <b>Alejandro Gutiérrez</b> · {essay.dateLabel} · {essay.wordCount.toLocaleString("es-CO")} palabras
            {essay.sources.length ? ` · ${essay.sources.length} fuentes` : ""}
          </div>
        </header>

        <div className="art-body">
          <div className="prose">{renderProse(essay.answer, { linker })}</div>

          <SourceApparatus sources={essay.sources} />
        </div>

        <div className="art-paso">
          <Link href="/archivo">
            <div className="pl">Seguir leyendo</div>
            <div className="pn">
              El archivo <span style={{ color: "var(--accent)" }}>→</span>
            </div>
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
