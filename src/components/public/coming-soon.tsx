import Link from "next/link";
import { PublicShell } from "@/components/public/public-shell";

/** Placeholder amable para secciones públicas aún no construidas (evita 404s al lanzar). */
export function ComingSoon({
  label,
  title,
  note,
  metodo,
}: {
  label: string;
  title: string;
  note?: string;
  metodo?: boolean;
}) {
  return (
    <PublicShell>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "72px 34px 120px" }} id={metodo ? "metodo" : undefined}>
        <div className="label" style={{ color: "var(--fg-muted)", marginBottom: 18 }}>
          {label}
        </div>
        <h1
          className="display"
          style={{ fontSize: "clamp(38px, 7vw, 68px)", lineHeight: 1.0, letterSpacing: "-0.02em", margin: 0 }}
        >
          {title}
        </h1>
        <p
          className="serif"
          style={{ fontStyle: "italic", fontSize: 21, color: "var(--fg-muted)", margin: "22px 0 0", lineHeight: 1.45, maxWidth: "48ch" }}
        >
          {note ?? "Esta sección está en construcción. Pronto la abrimos."}
        </p>
        <div style={{ marginTop: 36, display: "flex", gap: 18, fontFamily: "var(--font-mono)", fontSize: 12 }}>
          <Link href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>
            ← Volver a la portada
          </Link>
          <Link href="/archivo" style={{ color: "var(--fg-muted)", textDecoration: "none" }}>
            Ver el archivo
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
