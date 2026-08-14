import Link from "next/link";
import { PublicNavigation, type PublicNavigationStats } from "@/components/public/public-navigation";
import { getConnectedEntityCounts, getPublicArchiveStats } from "@/lib/public-data";
import "@/components/public/public-shell.css";

/** Chrome público global: navegación de atlas, menú móvil y pie editorial. */
export async function PublicShell({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  /**
   * La portada funciona como una edición completa: trae masthead, navegación y
   * pie propios. Las páginas interiores conservan el chrome público compacto.
   */
  variant?: "default" | "edition";
}) {
  if (variant === "edition") {
    return <div className="ps-page ps-page-edition">{children}</div>;
  }

  const [archive, connected] = await Promise.all([
    getPublicArchiveStats(),
    getConnectedEntityCounts(),
  ]);
  const stats: PublicNavigationStats = {
    hechos: archive.hechos,
    epocas: archive.epocas,
    biografias: archive.biografias,
    piezas: archive.total,
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
            <Link href="/como-trabajamos">Cómo trabajamos</Link>
            <Link href="/fuentes">Fuentes</Link>
            <Link href="/criterios-editoriales">Criterios editoriales</Link>
          </div>
          <div className="ps-foot-col">
            <div className="ps-foot-title">Archivo</div>
            <Link href="/hechos">Hechos</Link>
            <Link href="/epocas">Épocas</Link>
            <Link href="/linea-de-tiempo">Línea de tiempo</Link>
            <Link href="/mapa">Mapa</Link>
            <Link href="/archivo">Todo el archivo</Link>
          </div>
          <div className="ps-foot-col">
            <div className="ps-foot-title">Directorios</div>
            <Link href="/personas">Personajes</Link>
            <Link href="/lugares">Lugares</Link>
            <Link href="/ideas">Ideas</Link>
          </div>
          <div className="ps-foot-col">
            <div className="ps-foot-title">Proyecto</div>
            <Link href="/acerca">Acerca</Link>
            <Link href="/autor">El autor</Link>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/ensayos">Lecturas</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
