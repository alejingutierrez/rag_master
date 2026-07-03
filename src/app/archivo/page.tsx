import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";
import { getRecentEssays, getEssayCount } from "@/lib/public-data";
import { getPeriodColor } from "@/lib/design-tokens";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({
  seo: {
    metaTitle: "El archivo",
    metaDescription:
      "Todas las producciones publicadas: crónicas, ensayos, fichas y preguntas sobre la historia de Colombia, con fuentes.",
    keywords: ["archivo histórico", "historia de Colombia", "ensayos", "fuentes"],
  },
  path: "/archivo",
  type: "website",
});

export default async function ArchivoPage() {
  const [essays, total] = await Promise.all([getRecentEssays(60), getEssayCount()]);

  return (
    <PublicShell>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 34px" }}>
        <header style={{ borderBottom: "1px solid var(--fg)", padding: "44px 0 26px" }}>
          <div className="label" style={{ color: "var(--fg-muted)", marginBottom: 12 }}>
            El archivo · {total.toLocaleString("es-CO")} producciones
          </div>
          <h1 className="display" style={{ fontSize: "clamp(40px, 7vw, 76px)", lineHeight: 0.95, letterSpacing: "-0.02em", margin: 0 }}>
            Todo el archivo
          </h1>
          <p className="serif" style={{ fontStyle: "italic", fontSize: 19, color: "var(--fg-muted)", margin: "14px 0 0", maxWidth: "48ch" }}>
            Cada pieza nace de una pregunta al corpus. Ensayos, crónicas, capítulos, reportajes y podcasts.
          </p>
        </header>

        <ul style={{ listStyle: "none", margin: 0, padding: "6px 0 90px" }}>
          {essays.map((e) => {
            const color = e.periodCode ? getPeriodColor(e.periodCode) : "var(--fg-dim)";
            return (
              <li key={e.id}>
                <Link
                  href={`/ensayos/${e.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 24,
                    alignItems: "baseline",
                    padding: "17px 0",
                    borderTop: "1px solid var(--line)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "baseline", gap: 11, minWidth: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, transform: "translateY(-2px)" }} />
                    <span className="serif" style={{ fontSize: 20, color: "var(--fg)", lineHeight: 1.3 }}>
                      {e.title}
                    </span>
                  </span>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                    {e.formatName}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </PublicShell>
  );
}
