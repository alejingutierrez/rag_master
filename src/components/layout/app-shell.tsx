"use client";

import { useEffect, useMemo, useState } from "react";
import { Layout, Menu, Button, Tooltip, Space, Dropdown, theme } from "antd";
import {
  HomeOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  MessageOutlined,
  BookOutlined,
  AppstoreOutlined,
  RadarChartOutlined,
  ClusterOutlined,
  BulbOutlined,
  HeatMapOutlined,
  NodeIndexOutlined,
  UserOutlined,
  ReadOutlined,
  RocketOutlined,
  SunOutlined,
  MoonOutlined,
  LaptopOutlined,
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/providers/theme-provider";
import { CommandPalette } from "./command-palette";
import { KeyboardHelp } from "./keyboard-help";
import { safeGet, safeSet } from "@/lib/safe-storage";

const { Sider, Content } = Layout;

type NavItem = { key: string; label: string; icon: React.ReactNode };
type NavGroup = { type: "group"; label: string; children: NavItem[] };

const PRIMARY_NAV: NavGroup[] = [
  {
    type: "group",
    label: "Repositorio",
    children: [
      { key: "/", label: "Inicio", icon: <HomeOutlined /> },
      { key: "/upload", label: "Cargar PDFs", icon: <CloudUploadOutlined /> },
      { key: "/documents", label: "Documentos", icon: <FileTextOutlined /> },
      { key: "/enrich", label: "Enriquecer", icon: <ExperimentOutlined /> },
    ],
  },
  {
    type: "group",
    label: "Investigación",
    children: [
      { key: "/questions", label: "Preguntas", icon: <BookOutlined /> },
      { key: "/chat", label: "Consultar", icon: <MessageOutlined /> },
      { key: "/hypothesis", label: "Hipótesis", icon: <BulbOutlined /> },
      { key: "/deep-research", label: "Deep Research", icon: <RocketOutlined /> },
      { key: "/threads", label: "Hilos", icon: <NodeIndexOutlined /> },
      { key: "/workspaces", label: "Workspaces", icon: <ReadOutlined /> },
    ],
  },
  {
    type: "group",
    label: "Producción",
    children: [
      { key: "/producciones", label: "Producciones", icon: <AppstoreOutlined /> },
      { key: "/compare", label: "Comparador", icon: <ClusterOutlined /> },
      { key: "/bibliography", label: "Bibliografía", icon: <BookOutlined /> },
    ],
  },
  {
    type: "group",
    label: "Exploración",
    children: [
      { key: "/timeline", label: "Timeline", icon: <RadarChartOutlined /> },
      { key: "/graph", label: "Grafo", icon: <NodeIndexOutlined /> },
      { key: "/coverage", label: "Cobertura", icon: <HeatMapOutlined /> },
      { key: "/entities", label: "Entidades", icon: <UserOutlined /> },
    ],
  },
];

// Set de rutas top-level del menú (para selectedKey con rutas anidadas)
const TOP_LEVEL_ROUTES = PRIMARY_NAV.flatMap((g) => g.children.map((c) => c.key)).sort(
  (a, b) => b.length - a.length,
);

// Sub-rutas conocidas con su sección padre para resaltar en sider
const SUB_ROUTE_PARENT: Record<string, string> = {
  "/questions/matriz": "/questions",
  "/questions/generate": "/questions",
};

const ROUTE_LABELS: Record<string, string> = {
  "/": "Inicio",
  "/upload": "Cargar PDFs",
  "/documents": "Documentos",
  "/enrich": "Enriquecer",
  "/chat": "Consultar",
  "/deep-research": "Deep Research",
  "/hypothesis": "Hipótesis",
  "/questions": "Preguntas",
  "/questions/generate": "Generar preguntas",
  "/questions/matriz": "Matriz",
  "/threads": "Hilos",
  "/workspaces": "Workspaces",
  "/producciones": "Producciones",
  "/compare": "Comparador",
  "/bibliography": "Bibliografía",
  "/timeline": "Línea de tiempo",
  "/graph": "Grafo",
  "/coverage": "Cobertura",
  "/entities": "Entidades",
};

// Rutas dinámicas con label "Detalle"
const DYNAMIC_PARENTS = new Set([
  "/documents",
  "/threads",
  "/workspaces",
  "/producciones",
]);

const SIDER_COLLAPSED_KEY = "rag-master-sider-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  // Init desde localStorage para evitar CLS (en SSR siempre será false)
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    safeGet<boolean>(SIDER_COLLAPSED_KEY, false),
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { mode, resolved, setMode } = useTheme();
  const { token } = theme.useToken();

  // Detectar mobile y colapsar automáticamente
  useEffect(() => {
    const check = () => {
      const isMobile = window.innerWidth < 768;
      setMobile(isMobile);
      if (isMobile) setCollapsed(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Atajos de navegación tipo Linear: g+letra + modo lectura `f`
  useEffect(() => {
    let lastKey = "";
    let lastTime = 0;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const now = Date.now();
      const k = e.key.toLowerCase();

      // Modo lectura
      if (k === "f") {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }
      if (e.key === "Escape" && focusMode) {
        setFocusMode(false);
      }

      if (lastKey === "g" && now - lastTime < 800) {
        const map: Record<string, string> = {
          h: "/",
          d: "/documents",
          c: "/chat",
          q: "/questions",
          p: "/producciones",
          t: "/timeline",
          u: "/upload",
        };
        if (map[k]) {
          e.preventDefault();
          router.push(map[k]);
          lastKey = "";
          return;
        }
      }
      if (k === "g") {
        lastKey = "g";
        lastTime = now;
      } else {
        lastKey = "";
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, focusMode]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    safeSet(SIDER_COLLAPSED_KEY, next);
  };

  // Resaltar item del sider. Solo contra TOP_LEVEL_ROUTES; sub-rutas mapean a su padre.
  const selectedKey = useMemo(() => {
    if (SUB_ROUTE_PARENT[pathname]) return SUB_ROUTE_PARENT[pathname];
    return TOP_LEVEL_ROUTES.find((k) => pathname === k || pathname.startsWith(k + "/")) ?? "/";
  }, [pathname]);

  const themeIcon =
    mode === "light" ? <SunOutlined /> :
    mode === "dark" ? <MoonOutlined /> :
    <LaptopOutlined />;

  // Breadcrumb con detalle dinámico
  const breadcrumb = useMemo(() => {
    if (pathname === "/") return [{ label: "Inicio" }];
    const segs = pathname.split("/").filter(Boolean);
    const parts: { label: string; href?: string }[] = [{ label: "Inicio", href: "/" }];
    let cur = "";
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const prev = cur;
      cur += "/" + s;
      const known = ROUTE_LABELS[cur];
      if (known) {
        parts.push({ label: known, href: cur });
      } else if (DYNAMIC_PARENTS.has(prev)) {
        parts.push({ label: "Detalle" });
      } else {
        parts.push({ label: s.length > 16 ? s.slice(0, 14) + "…" : s });
      }
    }
    return parts;
  }, [pathname]);

  const siderWidth = focusMode ? 0 : collapsed ? 68 : 244;

  const siderNode = !focusMode ? (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      width={244}
      collapsedWidth={mobile ? 0 : 68}
      breakpoint="md"
      style={{
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        height: "100vh",
        overflow: "hidden auto",
        zIndex: 50,
      }}
    >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            padding: collapsed ? "0 16px" : "0 20px",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            gap: 10,
          }}
        >
          <Link
            href="/"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${token.colorPrimary}, #818CF8)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(99,102,241,0.25)",
              textDecoration: "none",
            }}
            aria-label="Inicio"
          >
            A
          </Link>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: token.colorText, lineHeight: 1.2 }}>
                Archivo Digital
              </div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: token.colorTextTertiary,
                  lineHeight: 1.2,
                  marginTop: 2,
                }}
              >
                Historia · Colombia
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div style={{ padding: "12px 12px 4px" }}>
            <Tooltip title="Búsqueda global (⌘K)" placement="right">
              <Button
                block
                icon={<SearchOutlined />}
                onClick={() => setPaletteOpen(true)}
                style={{
                  justifyContent: "space-between",
                  color: token.colorTextSecondary,
                }}
              >
                <span style={{ flex: 1, textAlign: "left", marginLeft: 6 }}>Buscar…</span>
                <kbd
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: token.colorFillSecondary,
                    color: token.colorTextTertiary,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  ⌘K
                </kbd>
              </Button>
            </Tooltip>
          </div>
        )}

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ borderRight: 0, padding: "8px 0 12px" }}
          items={PRIMARY_NAV.map((group) => ({
            type: "group",
            label: collapsed ? null : group.label,
            key: group.label,
            children: group.children.map((item) => ({
              key: item.key,
              icon: item.icon,
              label: <Link href={item.key}>{item.label}</Link>,
            })),
          }))}
        />
      </Sider>
  ) : null;

  const headerNode = !focusMode ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: mobile ? 0 : siderWidth,
            right: 0,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            zIndex: 40,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            background:
              resolved === "dark"
                ? "rgba(14,14,17,0.78)"
                : "rgba(255,255,255,0.78)",
            transition: "left 0.2s",
          }}
        >
          <Space size={10}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            />
            <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              {breadcrumb.map((c, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {i > 0 && <span style={{ color: token.colorTextQuaternary }}>/</span>}
                  {c.href && i < breadcrumb.length - 1 ? (
                    <Link href={c.href} style={{ color: token.colorTextSecondary }}>
                      {c.label}
                    </Link>
                  ) : (
                    <span style={{ color: token.colorText, fontWeight: 500 }}>{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </Space>

          <Space size={8}>
            <Tooltip title="Buscar (⌘K)">
              <Button
                type="text"
                icon={<SearchOutlined />}
                onClick={() => setPaletteOpen(true)}
                aria-label="Buscar"
              />
            </Tooltip>
            <Dropdown
              menu={{
                items: [
                  { key: "light", label: "Claro", icon: <SunOutlined />, onClick: () => setMode("light") },
                  { key: "dark", label: "Oscuro", icon: <MoonOutlined />, onClick: () => setMode("dark") },
                  { key: "auto", label: "Sistema", icon: <LaptopOutlined />, onClick: () => setMode("auto") },
                ],
                selectedKeys: [mode],
              }}
              trigger={["click"]}
            >
              <Tooltip title="Tema">
                <Button type="text" icon={themeIcon} aria-label="Cambiar tema" />
              </Tooltip>
            </Dropdown>
          </Space>
        </div>
  ) : null;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {siderNode}

      <Layout style={{ marginLeft: mobile || focusMode ? 0 : siderWidth, transition: "margin-left 0.2s" }}>
        {headerNode}

        {/* Spacer del header fijo */}
        {!focusMode && <div style={{ height: 64 }} />}

        <Content
          style={{
            minHeight: "calc(100vh - 64px)",
            background: token.colorBgLayout,
          }}
        >
          {children}
        </Content>
      </Layout>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(href) => {
          setPaletteOpen(false);
          router.push(href);
        }}
      />
      <KeyboardHelp />
    </Layout>
  );
}
