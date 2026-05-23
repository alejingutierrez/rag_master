"use client";

import { useEffect, useState } from "react";
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

const { Sider, Header, Content } = Layout;

const PRIMARY_NAV = [
  {
    type: "group" as const,
    label: "Repositorio",
    children: [
      { key: "/", label: "Inicio", icon: <HomeOutlined /> },
      { key: "/upload", label: "Cargar PDFs", icon: <CloudUploadOutlined /> },
      { key: "/documents", label: "Documentos", icon: <FileTextOutlined /> },
      { key: "/enrich", label: "Enriquecer", icon: <ExperimentOutlined /> },
    ],
  },
  {
    type: "group" as const,
    label: "Investigación",
    children: [
      { key: "/chat", label: "Consultar", icon: <MessageOutlined /> },
      { key: "/deep-research", label: "Deep Research", icon: <RocketOutlined /> },
      { key: "/hypothesis", label: "Hipótesis", icon: <BulbOutlined /> },
      { key: "/questions", label: "Preguntas", icon: <BookOutlined /> },
      { key: "/threads", label: "Hilos", icon: <NodeIndexOutlined /> },
      { key: "/workspaces", label: "Workspaces", icon: <ReadOutlined /> },
    ],
  },
  {
    type: "group" as const,
    label: "Producción",
    children: [
      { key: "/producciones", label: "Producciones", icon: <AppstoreOutlined /> },
      { key: "/compare", label: "Comparador", icon: <ClusterOutlined /> },
      { key: "/bibliography", label: "Bibliografía", icon: <BookOutlined /> },
    ],
  },
  {
    type: "group" as const,
    label: "Exploración",
    children: [
      { key: "/timeline", label: "Timeline", icon: <RadarChartOutlined /> },
      { key: "/graph", label: "Grafo", icon: <NodeIndexOutlined /> },
      { key: "/coverage", label: "Cobertura", icon: <HeatMapOutlined /> },
      { key: "/entities", label: "Entidades", icon: <UserOutlined /> },
    ],
  },
];

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
  "/threads": "Hilos de investigación",
  "/workspaces": "Workspaces",
  "/producciones": "Producciones",
  "/compare": "Comparador",
  "/bibliography": "Bibliografía",
  "/timeline": "Línea de tiempo",
  "/graph": "Grafo de conexiones",
  "/coverage": "Cobertura",
  "/entities": "Entidades",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { mode, resolved, setMode } = useTheme();
  const { token } = theme.useToken();

  useEffect(() => {
    const stored = localStorage.getItem("rag-master-sider-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("rag-master-sider-collapsed", String(next));
  };

  // Selected key — más específico primero
  const selectedKey = (() => {
    const candidates = Object.keys(ROUTE_LABELS).sort((a, b) => b.length - a.length);
    return candidates.find((k) => pathname === k || pathname.startsWith(k + "/")) ?? "/";
  })();

  const themeIcon =
    mode === "light" ? <SunOutlined /> :
    mode === "dark" ? <MoonOutlined /> :
    <LaptopOutlined />;

  // Breadcrumbs derivados
  const breadcrumb = (() => {
    if (pathname === "/") return [{ label: "Inicio" }];
    const segs = pathname.split("/").filter(Boolean);
    const parts: { label: string; href?: string }[] = [{ label: "Inicio", href: "/" }];
    let cur = "";
    for (const s of segs) {
      cur += "/" + s;
      const label = ROUTE_LABELS[cur] ?? s.slice(0, 12);
      parts.push({ label, href: cur });
    }
    return parts;
  })();

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={244}
        collapsedWidth={68}
        style={{
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "auto",
          overflowX: "hidden",
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
          <div
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
            }}
          >
            A
          </div>
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
          </div>
        )}

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ borderRight: 0, padding: "8px 0 12px" }}
          items={PRIMARY_NAV.map((group) => ({
            type: group.type,
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

      <Layout>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            position: "sticky",
            top: 0,
            zIndex: 10,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            backdropFilter: "blur(8px)",
            background:
              resolved === "dark"
                ? "rgba(14,14,17,0.85)"
                : "rgba(255,255,255,0.85)",
          }}
        >
          <Space size={10}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleCollapsed}
            />
            <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              {breadcrumb.map((c, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {i > 0 && <span style={{ color: token.colorTextQuaternary }}>/</span>}
                  {c.href && i < breadcrumb.length - 1 ? (
                    <Link
                      href={c.href}
                      style={{ color: token.colorTextSecondary }}
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span style={{ color: token.colorText, fontWeight: 500 }}>
                      {c.label}
                    </span>
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
              />
            </Tooltip>
            <Dropdown
              menu={{
                items: [
                  {
                    key: "light",
                    label: "Claro",
                    icon: <SunOutlined />,
                    onClick: () => setMode("light"),
                  },
                  {
                    key: "dark",
                    label: "Oscuro",
                    icon: <MoonOutlined />,
                    onClick: () => setMode("dark"),
                  },
                  {
                    key: "auto",
                    label: "Sistema",
                    icon: <LaptopOutlined />,
                    onClick: () => setMode("auto"),
                  },
                ],
                selectedKeys: [mode],
              }}
              trigger={["click"]}
            >
              <Tooltip title="Tema">
                <Button type="text" icon={themeIcon} />
              </Tooltip>
            </Dropdown>
          </Space>
        </Header>

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
    </Layout>
  );
}
