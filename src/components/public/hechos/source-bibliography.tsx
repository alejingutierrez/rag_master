import type { EssaySource } from "@/lib/public-data";

export interface SourceDocumentGroup {
  key: string;
  title: string;
  author: string | null;
  publicationYear: number | null;
  label: string;
  pages: number[];
  sources: EssaySource[];
}

function bibliographicKey(source: EssaySource): string {
  const identity = [source.documentTitle, source.author ?? "", source.publicationYear ?? ""]
    .join("|")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return identity ? `bibliography:${identity}` : `document:${source.documentId ?? source.label}`;
}

/** Agrupa fragmentos citados por documento sin inventar portadas ni tipos. */
export function groupEssaySources(sources: EssaySource[]): SourceDocumentGroup[] {
  const groups = new Map<string, SourceDocumentGroup>();
  for (const source of sources) {
    // El mismo PDF puede existir varias veces en almacenamiento. La superficie
    // pública cuenta obras bibliográficas, no ids internos duplicados.
    const key = bibliographicKey(source);
    const current = groups.get(key);
    if (current) {
      current.sources.push(source);
      if (source.page != null && !current.pages.includes(source.page)) current.pages.push(source.page);
      continue;
    }
    groups.set(key, {
      key,
      title: source.documentTitle,
      author: source.author,
      publicationYear: source.publicationYear,
      label: source.label,
      pages: source.page == null ? [] : [source.page],
      sources: [source],
    });
  }
  return [...groups.values()].map((group) => ({
    ...group,
    pages: [...group.pages].sort((a, b) => a - b),
  }));
}

function pageLabel(pages: number[]): string | null {
  if (!pages.length) return null;
  if (pages.length <= 5) return `p. ${pages.join(", ")}`;
  return `p. ${pages.slice(0, 4).join(", ")} y ${pages.length - 4} más`;
}

/**
 * Bibliografía documental del hecho. Todo es texto: el producto no dispone de
 * imágenes documentales verificadas y esta superficie no simula cubiertas.
 */
export function SourceBibliography({ sources }: { sources: EssaySource[] }) {
  const groups = groupEssaySources(sources);
  return (
    <section className="hd-sources" id="fuentes" aria-labelledby="hd-sources-title">
      <header className="hd-section-head">
        <span>07</span>
        <div>
          <p>Archivo documental</p>
          <h2 id="hd-sources-title">Documentos y fragmentos citados</h2>
          <div className="hd-source-stats">
            {groups.length.toLocaleString("es-CO")} documentos · {sources.length.toLocaleString("es-CO")} fragmentos
          </div>
        </div>
      </header>

      {groups.length ? (
        <div className="hd-source-list">
          {groups.map((group, index) => (
            <div className="hd-source-document" key={group.key}>
              {group.sources.map((source) => (
                <span key={source.n} id={`f${source.n}`} className="hd-source-anchor" aria-hidden />
              ))}
              <details>
                <summary>
                  <span className="hd-source-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="hd-source-copy">
                    <strong>{group.title}</strong>
                    <small>
                      {[group.author, group.publicationYear, pageLabel(group.pages)]
                        .filter(Boolean)
                        .join(" · ") || "Documento del corpus"}
                    </small>
                  </span>
                  <span className="hd-source-count">{group.sources.length} {group.sources.length === 1 ? "cita" : "citas"}</span>
                </summary>
                <div className="hd-source-fragments">
                  {group.sources.map((source) => (
                    <blockquote key={source.n}>
                      <b>[{source.n}]</b>
                      <span>{source.snippet ?? "Fragmento referenciado en el corpus."}</span>
                      {source.page != null ? <small>p. {source.page}</small> : null}
                    </blockquote>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <p className="hd-source-empty">Esta síntesis conserva sus fuentes en el corpus editorial.</p>
      )}
    </section>
  );
}
