import Link from "next/link";
import { BrandMark } from "@/components/public/brand-mark";
import "@/components/public/public-shell.css";

const NAV = [
  { href: "/", label: "Portada" },
  { href: "/epocas", label: "Épocas" },
  { href: "/linea-de-tiempo", label: "Línea de tiempo" },
  { href: "/personas", label: "Personas" },
  { href: "/lugares", label: "Lugares" },
  { href: "/ideas", label: "Ideas" },
  { href: "/ensayos", label: "Ensayos" },
];

/**
 * Chrome público del sitio (cabecera + pie), separado del AppShell del admin.
 * Reusa los tokens Archivo (var(--*)) y las fuentes reales.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg)", color: "var(--fg)", minHeight: "100vh" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--bg)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="ps-bar">
          <BrandMark />
          <nav className="ps-nav">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="ps-navlink">
                {item.label}
              </Link>
            ))}
            <Link href="/acerca" className="ps-navlink">
              Acerca
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer className="ps-footer">
        <div className="ps-footer-grid">
          <div>
            <div className="display" style={{ fontSize: 24, color: "var(--fg)", marginBottom: 8 }}>
              Historia Colombiana
            </div>
            <div
              className="serif"
              style={{ fontStyle: "italic", fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.4, maxWidth: "30ch" }}
            >
              Ensayos sobre el pasado de Colombia, con las fuentes a la vista.
            </div>
            <div className="label" style={{ marginTop: 16, color: "var(--fg-faint)" }}>
              Escrito por Alejandro Gutiérrez
            </div>
          </div>
          <div className="ps-foot-col">
            <div className="label" style={{ marginBottom: 12 }}>Secciones</div>
            <Link href="/" className="ps-foot-link">Portada</Link>
            <Link href="/epocas" className="ps-foot-link">Épocas</Link>
            <Link href="/linea-de-tiempo" className="ps-foot-link">Línea de tiempo</Link>
            <Link href="/personas" className="ps-foot-link">Personas</Link>
            <Link href="/lugares" className="ps-foot-link">Lugares</Link>
            <Link href="/ideas" className="ps-foot-link">Ideas</Link>
          </div>
          <div className="ps-foot-col">
            <div className="label" style={{ marginBottom: 12 }}>Épocas</div>
            <Link href="/linea-de-tiempo?p=IND" className="ps-foot-link">Independencia</Link>
            <Link href="/linea-de-tiempo?p=REG" className="ps-foot-link">Regeneración</Link>
            <Link href="/linea-de-tiempo?p=VIO" className="ps-foot-link">La Violencia</Link>
            <Link href="/linea-de-tiempo?p=POS" className="ps-foot-link">Posconflicto</Link>
          </div>
          <div className="ps-foot-col">
            <div className="label" style={{ marginBottom: 12 }}>El proyecto</div>
            <Link href="/acerca" className="ps-foot-link">Acerca</Link>
            <Link href="/acerca#metodo" className="ps-foot-link">Método y fuentes</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
