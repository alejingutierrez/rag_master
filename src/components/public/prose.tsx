/**
 * Render de markdown ligero → bloques de .prose para el sitio público.
 * Compartido por el detalle de ensayo y las fichas de tipología. Soporta
 * citas [#n]/[n] (ancla a fuentes), **negrita**, *itálica*, listas, blockquote.
 *
 * Auto-enlace wiki: si se pasa un `linker`, las menciones de entidades en el
 * cuerpo (párrafos, listas, citas en bloque) se convierten en enlaces a su
 * página — primera mención por pieza. Los encabezados NO se enlazan.
 */
import type React from "react";
import { linkText, type EntityLinker, type LinkCtx } from "@/lib/entity-linker";

export interface ProseOptions {
  linker?: EntityLinker | null;
  /** `${type}:${slug}` de la entidad de esta página — no auto-enlazar a sí misma. */
  selfKey?: string;
}

/** Máximo de auto-enlaces por pieza (evita saturar una prosa larga). */
const LINK_CAP = 60;

interface InlineCtx extends LinkCtx {
  linker: EntityLinker;
}

function emit(text: string, ctx: InlineCtx | null): React.ReactNode {
  if (!ctx?.linker?.regex) return text;
  return linkText(text, ctx.linker, ctx);
}

/** Inline: [#n]/[n] → cita superíndice, **negrita**, *itálica*, + auto-enlace. */
export function renderInline(text: string, ctx: InlineCtx | null = null) {
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
      parts.push(<strong key={k++}>{emit(bMatch[1], ctx)}</strong>);
      r = r.slice(bMatch[0].length);
    } else if (iMatch) {
      parts.push(<em key={k++}>{emit(iMatch[1], ctx)}</em>);
      r = r.slice(iMatch[0].length);
    } else {
      const nextC = r.search(/\[#?\d+\]/);
      const nextB = r.indexOf("**");
      const nextI = r.indexOf("*");
      const cand = [nextC, nextB, nextI].filter((x) => x >= 0);
      const stop = cand.length ? Math.min(...cand) : r.length;
      const slice = r.slice(0, Math.max(stop, 1));
      parts.push(<span key={k++}>{emit(slice, ctx)}</span>);
      r = r.slice(slice.length);
    }
  }
  return parts;
}

/** Markdown ligero → bloques de .prose. El `#` de nivel 1 se degrada a h2. */
export function renderProse(markdown: string, opts: ProseOptions = {}) {
  const ctx: InlineCtx | null = opts.linker?.regex
    ? { linker: opts.linker, linked: new Set(), selfKey: opts.selfKey, counter: { n: 0 }, cap: LINK_CAP }
    : null;

  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];
  let bq: string[] = [];
  const flush = (i: number) => {
    if (bq.length) {
      blocks.push(
        <blockquote key={`bq${i}`}>
          {bq.map((l, j) => (
            <p key={j} style={{ margin: 0 }}>
              {renderInline(l, ctx)}
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
    // Encabezados sin auto-enlace (ctx omitido).
    if (line.startsWith("### ")) blocks.push(<h3 key={i}>{renderInline(line.slice(4))}</h3>);
    else if (line.startsWith("## ")) blocks.push(<h2 key={i}>{renderInline(line.slice(3))}</h2>);
    else if (line.startsWith("# ")) blocks.push(<h2 key={i}>{renderInline(line.slice(2))}</h2>);
    else if (line.startsWith("- ") || line.startsWith("* "))
      blocks.push(
        <li key={i} style={{ marginLeft: 20 }}>
          {renderInline(line.slice(2), ctx)}
        </li>,
      );
    else if (/^\d+\.\s/.test(line))
      blocks.push(
        <li key={i} style={{ marginLeft: 20 }}>
          {renderInline(line.replace(/^\d+\.\s/, ""), ctx)}
        </li>,
      );
    else if (line.trim() !== "") blocks.push(<p key={i}>{renderInline(line, ctx)}</p>);
  });
  flush(lines.length);
  return blocks;
}
