"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Logo "Historia Colombiana" del menú. En el HOME manda el hero grande, así que
 * el menú NO lo repite; al salir del home, "Historia" regresa al menú con una
 * pequeña animación (fina coquetería). El `view-transition-name` compartido con
 * el hero permite, si se activa la View Transitions API, un morph real.
 */
export function BrandMark() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  if (isHome) return <span className="ps-brand-spacer" aria-hidden />;
  return (
    <Link href="/" className="display ps-brand">
      Historia Colombiana
    </Link>
  );
}
