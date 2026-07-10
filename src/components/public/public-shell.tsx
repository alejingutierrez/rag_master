import Link from "next/link";
import { PublicNavigation, type PublicNavigationStats } from "@/components/public/public-navigation";
import { getConnectedEntityCounts, getPublicArchiveStats } from "@/lib/public-data";
import { loadTimeline } from "@/lib/timeline-data";
import "@/components/public/public-shell.css";

function eventCount(periods: Awaited<ReturnType<typeof loadTimeline>>["periods"]): number {
  let total = 0;
  for (const slice of Object.values(periods)) total += slice.events.length;
  return total;
}

/** Chrome público global: navegación de atlas, menú móvil y pie editorial. */
export async function PublicShell({ children }: { children: React.ReactNode }) {
  const [archive, connected, timeline] = await Promise.all([
    getPublicArchiveStats(),
    getConnectedEntityCounts(),
    loadTimeline().catch(() => null),
  ]);
  const stats: PublicNavigationStats = {
    hechos: archive.hechos,
    epocas: archive.epocas,
    biografias: archive.biografias,
    preguntas: archive.preguntas,
    piezas: archive.total,
    timelineEvents: timeline ? eventCount(timeline.periods) : 0,
    personas: connected.persona,
    lugares: connected.lugar,
    ideas: connected.idea,
  };

  return (
    <div className="ps-page">
      <header className="ps-header">
        <PublicNavigation stats={stats} />
      </header>

      <main>{children}</main>

      <footer className="ps-footer">
        <div className="ps-footer-grid">
          <div className="ps-footer-brand">
            <Link href="/" className="ps-footer-wordmark">Historia Colombiana</Link>
            <p>Un archivo vivo del pasado de Colombia, con las fuentes siempre a la vista.</p>
            <span>Escrito por Alejandro Gutiérrez</span>
          </div>
          <div className="ps-foot-col">
            <div className="ps-foot-title">Método y fuentes</div>
            <Link href="/acerca#metodo">Cómo trabajamos</Link>
            <Link href="/acerca#metodo">Fuentes</Link>
            <Link href="/acerca">Criterios editoriales</Link>
          </div>
          <div className="ps-foot-col">
            <div className="ps-foot-title">Archivo</div>
            <Link href="/hechos">Hechos</Link>
            <Link href="/epocas">Épocas</Link>
            <Link href="/linea-de-tiempo">Línea de tiempo</Link>
            <Link href="/archivo">Todo el archivo</Link>
          </div>
          <div className="ps-foot-col">
            <div className="ps-foot-title">Directorios</div>
            <Link href="/personas">Personas</Link>
            <Link href="/lugares">Lugares</Link>
            <Link href="/ideas">Ideas</Link>
          </div>
          <div className="ps-foot-col">
            <div className="ps-foot-title">Proyecto</div>
            <Link href="/acerca">Acerca</Link>
            <Link href="/ensayos">Lecturas</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
