"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Repositorio",
    items: [
      { href: "/", label: "Inicio" },
      { href: "/documents", label: "Documentos" },
      { href: "/upload", label: "Cargar" },
      { href: "/enrich", label: "Enriquecer" },
    ],
  },
  {
    label: "Investigación",
    items: [
      { href: "/chat", label: "Consultar" },
      { href: "/questions", label: "Preguntas" },
      { href: "/preguntas-madre", label: "Preguntas madre" },
      { href: "/atelier", label: "El Taller" },
    ],
  },
  {
    label: "Producción",
    items: [
      { href: "/producciones", label: "Producciones" },
      { href: "/bibliography", label: "Bibliografía" },
    ],
  },
  {
    label: "Exploración",
    items: [
      { href: "/timeline", label: "Línea de tiempo" },
      { href: "/graph", label: "Grafo" },
      { href: "/entities", label: "Entidades" },
    ],
  },
];

const ALL_ROUTES = NAV.flatMap((g) => g.items.map((i) => i.href)).sort(
  (a, b) => b.length - a.length,
);

const SUB_ROUTE_PARENT: Record<string, string> = {
  "/questions/matriz": "/questions",
  "/questions/generate": "/questions",
};

export interface SidebarProps {
  versionText?: string;
}

export function Sidebar({ versionText = "0.4.2 · Archivo Vivo" }: SidebarProps) {
  const pathname = usePathname();

  const selectedHref = useMemo(() => {
    if (SUB_ROUTE_PARENT[pathname]) return SUB_ROUTE_PARENT[pathname];
    return (
      ALL_ROUTES.find((r) => pathname === r || pathname.startsWith(r + "/")) ??
      "/"
    );
  }, [pathname]);

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: "1px solid var(--line)",
        background: "var(--bg)",
        minHeight: "100vh",
        padding: "26px 0 26px",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        overflowY: "auto",
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
      }}
      aria-label="Navegación principal"
    >
      {/* Brand */}
      <div style={{ padding: "0 24px 28px" }}>
        <Link
          href="/"
          aria-label="Inicio"
          style={{ display: "block", textDecoration: "none" }}
        >
          <div
            className="display"
            style={{
              fontSize: 24,
              lineHeight: 1.0,
              color: "var(--fg)",
              padding: 0,
            }}
          >
            Archivo
          </div>
          <div className="label" style={{ marginTop: 6 }}>
            Colombia · MMXXVI
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 12px" }}>
        {NAV.map((group) => (
          <div key={group.label} style={{ marginBottom: 22 }}>
            <div
              className="label"
              style={{ padding: "0 12px 8px", color: "var(--fg-faint)" }}
            >
              {group.label}
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {group.items.map((item) => {
                const active = item.href === selectedHref;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "5px 12px",
                        color: active ? "var(--fg)" : "var(--fg-muted)",
                        fontSize: 13.5,
                        textAlign: "left",
                        fontWeight: active ? 500 : 400,
                        position: "relative",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        transition: "color 120ms var(--ease-out-custom)",
                      }}
                    >
                      {active && (
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: "50%",
                            width: 2,
                            height: 14,
                            marginTop: -7,
                            background: "var(--accent)",
                          }}
                        />
                      )}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: "16px 24px 0", borderTop: "1px solid var(--line)" }}>
        <div className="label" style={{ marginBottom: 6 }}>
          Versión
        </div>
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
          {versionText}
        </div>
      </div>
    </aside>
  );
}
