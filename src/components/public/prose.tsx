/**
 * Render de markdown ligero → bloques de .prose para el sitio público.
 * Compartido por el detalle de ensayo y las fichas de tipología. Soporta
 * citas [#n]/[n] (ancla a fuentes), **negrita**, *itálica*, listas, blockquote.
 */
import type React from "react";

/** Inline: [#n]/[n] → cita superíndice, **negrita**, *itálica*. */
export function renderInline(text: string) {
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

/** Markdown ligero → bloques de .prose. El `#` de nivel 1 se degrada a h2. */
export function renderProse(markdown: string) {
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
      blocks.push(
        <li key={i} style={{ marginLeft: 20 }}>
          {renderInline(line.slice(2))}
        </li>,
      );
    else if (/^\d+\.\s/.test(line))
      blocks.push(
        <li key={i} style={{ marginLeft: 20 }}>
          {renderInline(line.replace(/^\d+\.\s/, ""))}
        </li>,
      );
    else if (line.trim() !== "") blocks.push(<p key={i}>{renderInline(line)}</p>);
  });
  flush(lines.length);
  return blocks;
}
