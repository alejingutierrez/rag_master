import type { EssaySource } from "@/lib/public-data";

/**
 * Aparato lateral de fuentes, NUMERADO y desplegable: cada numeral abre el
 * fragmento exacto (chunk) que respalda la cita, con el nombre bibliográfico
 * real. Los `[n]` de la prosa anclan aquí (href="#f{n}"). Cero JS (`<details>`).
 */
export function SourceApparatus({ sources }: { sources: EssaySource[] }) {
  return (
    <aside className="art-apx">
      <span className="al">Aparato · fuentes</span>
      {sources.length ? (
        sources.map((s) =>
          s.snippet ? (
            <details key={s.n} className="art-src-x" id={`f${s.n}`}>
              <summary>
                <span className="n">{s.n}</span>
                <span className="t">
                  {s.label}
                  {s.page ? <span className="pg"> · p. {s.page}</span> : null}
                  <span className="cue">ver ▸</span>
                </span>
              </summary>
              <blockquote className="art-src-q">«{s.snippet}»</blockquote>
            </details>
          ) : (
            <div key={s.n} className="art-src" id={`f${s.n}`}>
              <span className="n">{s.n}</span>
              <span className="t">
                {s.label}
                {s.page ? <span className="pg"> · p. {s.page}</span> : null}
              </span>
            </div>
          ),
        )
      ) : (
        <div className="art-src">
          <span className="t" style={{ gridColumn: "1 / -1" }}>
            Producción de síntesis; fuentes en el corpus.
          </span>
        </div>
      )}
    </aside>
  );
}
