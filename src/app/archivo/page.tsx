import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { getPublicArchiveStats, getRecentPublicPieces } from "@/lib/public-data";
import { getPeriodColor } from "@/lib/design-tokens";
import { buildMetadata } from "@/lib/seo";
import "./archivo.css";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({
  seo: {
    metaTitle: "El archivo",
    metaDescription:
      "Todas las producciones publicadas: hechos, épocas, biografías y preguntas sobre la historia de Colombia, con sus fuentes.",
    keywords: ["archivo histórico", "historia de Colombia", "hechos", "fuentes"],
  },
  path: "/archivo",
  type: "website",
});

function number(value: number): string {
  return value.toLocaleString("es-CO");
}

export default async function ArchivoPage() {
  const [pieces, stats] = await Promise.all([
    getRecentPublicPieces(300),
    getPublicArchiveStats(),
  ]);

  return (
    <PublicShell>
      <div className="ar-wrap">
        <header className="ar-head">
          <div className="ar-kicker">Archivo público · {number(stats.total)} piezas</div>
          <div className="ar-title-row">
            <h1>Todo el archivo</h1>
            <p>
              Una puerta única a las piezas publicadas. Cada entrada conserva su ruta correcta
              y conduce a la historia, la biografía o la lectura que realmente existe.
            </p>
          </div>
          <dl className="ar-stats">
            <div><dt>{number(stats.hechos)}</dt><dd>hechos</dd></div>
            <div><dt>{number(stats.epocas)}</dt><dd>épocas</dd></div>
            <div><dt>{number(stats.biografias)}</dt><dd>biografías</dd></div>
            <div><dt>{number(stats.preguntas + stats.lecturas)}</dt><dd>lecturas</dd></div>
            <div><dt>{number(stats.documents)}</dt><dd>documentos citados</dd></div>
            <div><dt>{number(stats.fragments)}</dt><dd>fragmentos</dd></div>
          </dl>
        </header>

        <section className="ar-catalog" aria-labelledby="archivo-listado">
          <div className="ar-catalog-head">
            <h2 id="archivo-listado">Piezas publicadas</h2>
            <span>Más recientes primero</span>
          </div>
          <ol className="ar-list">
            {pieces.map((piece, index) => (
              <li key={piece.id}>
                <Link href={piece.href}>
                  <span className="ar-index">{String(index + 1).padStart(2, "0")}</span>
                  <span
                    className="ar-type"
                    style={{ "--ar-dot": getPeriodColor(piece.periodCode ?? "TRANS") } as React.CSSProperties}
                  >
                    {piece.label}
                  </span>
                  <span className="ar-copy">
                    <strong>{piece.title}</strong>
                    {piece.summary ? <small>{piece.summary}</small> : null}
                  </span>
                  <span className="ar-year">{piece.yearLabel ?? "—"}</span>
                  <span className="ar-arrow" aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </PublicShell>
  );
}
