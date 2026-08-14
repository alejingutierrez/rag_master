import Link from "next/link";
import type { HomeArchiveEvidence, HomeEditionCounts } from "./types";
import { EditorialArrow, formatEditorialNumber } from "./primitives";

const FOOT_LINKS = [
  { href: "/epocas", label: "Épocas" },
  { href: "/hechos", label: "Hechos" },
  { href: "/personas", label: "Personajes" },
  { href: "/ideas", label: "Ideas" },
  { href: "/lugares", label: "Lugares" },
  { href: "/mapa", label: "Mapa" },
  { href: "/archivo", label: "Archivo" },
] as const;

export function HomeImprint({
  editionLabel,
  counts,
  evidence,
}: {
  editionLabel: string;
  counts: HomeEditionCounts;
  evidence: HomeArchiveEvidence;
}) {
  return (
    <footer className="hc-imprint">
      <div className="hc-imprint-main">
        <div className="hc-imprint-brand">
          <Link href="/">Historia Colombiana</Link>
          <p>Un archivo vivo del pasado de Colombia, con las fuentes siempre a la vista.</p>
          <span>Escrito y editado por Alejandro Gutiérrez</span>
        </div>

        <div className="hc-imprint-edition">
          <p className="hc-eyebrow">Esta edición</p>
          <h2>{editionLabel}</h2>
          <dl>
            <div><dt>{formatEditorialNumber(counts.pieces)}</dt><dd>piezas</dd></div>
            <div><dt>{formatEditorialNumber(counts.facts)}</dt><dd>hechos</dd></div>
            <div><dt>{formatEditorialNumber(counts.people + counts.places + counts.ideas)}</dt><dd>conexiones</dd></div>
          </dl>
        </div>

        <div className="hc-imprint-method">
          <p className="hc-eyebrow">Archivo global</p>
          <dl>
            <div><dt>{formatEditorialNumber(evidence.documents)}</dt><dd>documentos citados</dd></div>
            <div><dt>{formatEditorialNumber(evidence.fragments)}</dt><dd>fragmentos</dd></div>
            <div><dt>{formatEditorialNumber(evidence.words)}</dt><dd>palabras</dd></div>
            <div><dt>{formatEditorialNumber(evidence.readingHours)}</dt><dd>horas de lectura</dd></div>
          </dl>
          <div>
            <Link href="/como-trabajamos">Cómo trabajamos <EditorialArrow /></Link>
            <Link href="/fuentes">Fuentes <EditorialArrow /></Link>
            <Link href="/criterios-editoriales">Criterios editoriales <EditorialArrow /></Link>
          </div>
        </div>
      </div>

      <nav className="hc-imprint-nav" aria-label="Navegación del pie">
        {FOOT_LINKS.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
      </nav>
      <div className="hc-imprint-legal">
        <span>© {new Date().getFullYear()} Historia Colombiana</span>
        <span>Bogotá · Colombia</span>
        <Link href="/acerca">Acerca del proyecto</Link>
        <Link href="/privacidad">Privacidad</Link>
      </div>
    </footer>
  );
}
