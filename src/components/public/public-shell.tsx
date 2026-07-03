import Link from "next/link";

const NAV = [
  { href: "/", label: "Portada" },
  { href: "/epocas", label: "Épocas" },
  { href: "/linea-de-tiempo", label: "Línea de tiempo" },
  { href: "/personas", label: "Personas" },
  { href: "/lugares", label: "Lugares" },
  { href: "/ideas", label: "Ideas" },
  { href: "/ensayos", label: "Ensayos" },
];

const navLink: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.09em",
  color: "var(--fg-muted)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const footCol: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const footLink: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  color: "var(--fg-muted)",
  textDecoration: "none",
  marginBottom: 8,
};

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
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "0 34px",
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <Link
            href="/"
            className="display"
            style={{ fontSize: 21, lineHeight: 1, color: "var(--fg)", textDecoration: "none", padding: 0 }}
          >
            Historia Colombiana
          </Link>
          <nav style={{ display: "flex", gap: 20, alignItems: "center", overflowX: "auto" }}>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} style={navLink}>
                {item.label}
              </Link>
            ))}
            <Link href="/acerca" style={navLink}>
              Acerca
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      <footer style={{ borderTop: "1px solid var(--fg)", marginTop: 44 }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "36px 34px 60px",
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
            gap: 26,
          }}
        >
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
          <div style={footCol}>
            <div className="label" style={{ marginBottom: 12 }}>Secciones</div>
            <Link href="/" style={footLink}>Portada</Link>
            <Link href="/epocas" style={footLink}>Épocas</Link>
            <Link href="/linea-de-tiempo" style={footLink}>Línea de tiempo</Link>
            <Link href="/personas" style={footLink}>Personas</Link>
            <Link href="/lugares" style={footLink}>Lugares</Link>
            <Link href="/ideas" style={footLink}>Ideas</Link>
          </div>
          <div style={footCol}>
            <div className="label" style={{ marginBottom: 12 }}>Épocas</div>
            <Link href="/epocas/ind" style={footLink}>Independencia</Link>
            <Link href="/epocas/reg" style={footLink}>Regeneración</Link>
            <Link href="/epocas/vio" style={footLink}>La Violencia</Link>
            <Link href="/epocas/pos" style={footLink}>Posconflicto</Link>
          </div>
          <div style={footCol}>
            <div className="label" style={{ marginBottom: 12 }}>El proyecto</div>
            <Link href="/acerca" style={footLink}>Acerca</Link>
            <Link href="/acerca#metodo" style={footLink}>Método y fuentes</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
