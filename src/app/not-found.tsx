import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página no encontrada",
  description: "La página solicitada no existe en Historia Colombiana.",
  alternates: { canonical: null },
  robots: { index: false, follow: false, noarchive: true },
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "var(--bg)",
        color: "var(--fg)",
      }}
    >
      <section style={{ maxWidth: 640, textAlign: "center" }}>
        <p style={{ color: "var(--accent)", fontWeight: 600 }}>Error 404</p>
        <h1 style={{ margin: "0.75rem 0", fontSize: "clamp(2rem, 7vw, 4.5rem)" }}>
          Página no encontrada
        </h1>
        <p style={{ color: "var(--fg-muted)", lineHeight: 1.7 }}>
          La dirección puede haber cambiado o la pieza ya no está disponible.
        </p>
        <Link
          href="/"
          style={{ display: "inline-block", marginTop: "1.5rem", textDecoration: "underline" }}
        >
          Volver a Historia Colombiana
        </Link>
      </section>
    </main>
  );
}
