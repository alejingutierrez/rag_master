import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public/public-shell";
import { JsonLd } from "@/components/public/json-ld";
import { getEssay } from "@/lib/public-data";
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

/** Inline: [#n]/[n] → cita superíndice (ancla a la fuente), **negrita**, *itálica*. */
function renderInline(text: string) {
  const parts: React.ReactNode[] = [];
  let r = text;
  let k = 0;
  while (r.length) {
    const cMatch = r.match(/^\[#?(\d+)\]/);
    const bMatch = r.match(/^\*\*([^*]+)\*\*/);
    const iMatch = r.match(/^\*([^*]+)\*/);
    if (cMatch) {
      const n = parseInt(cMatch[1], 10);
      parts.push(
        <a key={k++} className="cita" href={`#f${n}`}>
          {n}
        </a>,
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
      const cand = [nextC, nextB, nextI].filter((x) => x >= 0);
      const stop = cand.length ? Math.min(...cand) : r.length;
      const slice = r.slice(0, Math.max(stop, 1));
      parts.push(<span key={k++}>{slice}</span>);
      r = r.slice(slice.length);
    }
  }
  return parts;
}

/** Markdown ligero → bloques de .prose. El título de la página es el h1; los `#` se degradan a h2. */
function renderProse(markdown: string) {
  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];
  let bq: string[] = [];
  const flush = (i: number) => {
    if (bq.length) {
      blocks.push(
        <blockquote key={`bq${i}`}>
          {bq.map((l, j) => (
            <p key={j} style={{ margin: 0 }}>
              {renderInline(l)}
            </p>
          ))}
        </blockquote>,
      );
      bq = [];
    }
  };
  lines.forEach((line, i) => {
    if (line.startsWith("> ")) {
      bq.push(line.slice(2));
      return;
    }
    flush(i);
    if (line.startsWith("### ")) blocks.push(<h3 key={i}>{renderInline(line.slice(4))}</h3>);
    else if (line.startsWith("## ")) blocks.push(<h2 key={i}>{renderInline(line.slice(3))}</h2>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={i}>{renderInline(line.slice(2))}</h2>);
    else if (line.startsWith("- ") || line.startsWith("* "))
      blocks.push(<li key={i} style={{ marginLeft: 20 }}>{renderInline(line.slice(2))}</li>);
    else if (/^\d+\.\s/.test(line))
      blocks.push(<li key={i} style={{ marginLeft: 20 }}>{renderInline(line.replace(/^\d+\.\s/, ""))}</li>);
    else if (line.trim() !== "") blocks.push(<p key={i}>{renderInline(line)}</p>);
  });
  flush(lines.length);
  return blocks;
}

export default async function EnsayoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const essay = await getEssay(id);
  if (!essay) notFound();

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
          <div className="prose">{renderProse(essay.answer)}</div>

          <aside className="art-apx">
            <span className="al">Aparato · fuentes</span>
            {essay.sources.length ? (
              essay.sources.map((s) => (
                <div key={s.n} className="art-src" id={`f${s.n}`}>
                  <span className="n">{s.n}</span>
                  <span className="t">
                    {s.label}
                    {s.page ? <span className="pg"> · p. {s.page}</span> : null}
                  </span>
                </div>
              ))
            ) : (
              <div className="art-src">
                <span className="t" style={{ gridColumn: "1 / -1" }}>
                  Producción de síntesis; fuentes en el corpus.
                </span>
              </div>
            )}
          </aside>
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
