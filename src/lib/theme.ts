/**
 * Sistema de diseño para Archivo Histórico Digital.
 * Tokens compartidos entre Ant Design y CSS variables propias.
 *
 * Estética: Workspace data-rich pro (Notion/Linear/Vercel),
 * con guiños académicos: serif para títulos largos, neutros profundos,
 * acento violeta-índigo (intelectual) + ámbar (académico) para destacar.
 */

import type { ThemeConfig } from "antd";

// ─── Brand colors ────────────────────────────────────────────────────────────
// Indigo profundo como primary (intelectual, sobrio). Ámbar reservado para
// estados/acentos académicos puntuales (citas, anclas históricas).

export const BRAND = {
  primary: "#6366F1",        // Indigo 500 — acción principal
  primaryHover: "#4F46E5",   // Indigo 600
  primaryActive: "#4338CA",  // Indigo 700

  accent: "#F59E0B",         // Ámbar 500 — anclas históricas, citas
  accentHover: "#D97706",    // Ámbar 600

  success: "#10B981",        // Emerald 500
  warning: "#F59E0B",
  error: "#EF4444",          // Rojo 500
  info: "#3B82F6",           // Azul 500
};

// ─── Colores por período histórico ───────────────────────────────────────────
// Cada período tiene un color identitario para usar en badges, timeline, graph.
// Progresión cromática: prehispánico (terracota) → colonial (oliva/dorado) →
// independencia (azul) → moderno (violeta) → contemporáneo (gris+verde).

export const PERIOD_COLORS: Record<string, string> = {
  PRE: "#B45309",      // Ámbar oscuro — prehispánico
  CON: "#92400E",      // Marrón cobrizo — conquista
  COL: "#78350F",      // Marrón profundo — colonia madura
  PRE_IND: "#A16207",  // Oliva dorado — pre-independencia
  IND: "#1E40AF",      // Azul rey — independencia
  NGR: "#1D4ED8",      // Azul liberal — Nueva Granada
  EUC: "#2563EB",      // Azul radical — Estados Unidos de Colombia
  REG: "#7C2D12",      // Marrón conservador — Regeneración
  REP_LIB: "#0F766E",  // Verde azulado — República Liberal
  VIO: "#991B1B",      // Rojo sangre — La Violencia
  FN: "#4F46E5",       // Indigo — Frente Nacional
  CNA: "#7C3AED",      // Violeta — Crisis y narcotráfico
  C91: "#DB2777",      // Rosa magenta — Constitución 91
  SDE: "#0891B2",      // Cyan — Seguridad Democrática
  POS: "#059669",      // Esmeralda — Posconflicto
  TRANS: "#6B7280",    // Gris — Transversal
};

// ─── Colores por categoría temática ──────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  POL: "#1E40AF",  // Azul — Política
  ECO: "#059669",  // Verde — Economía
  CON: "#DC2626",  // Rojo — Conflicto
  SOC: "#F59E0B",  // Ámbar — Sociedad
  CUL: "#7C3AED",  // Violeta — Cultura
  REL: "#0891B2",  // Cyan — Relaciones internacionales
  TER: "#65A30D",  // Verde olivo — Territorio
  MOV: "#DB2777",  // Magenta — Movimientos sociales
  INS: "#475569",  // Gris pizarra — Instituciones
  HIS: "#A855F7",  // Púrpura — Historiografía
};

// ─── Configuración Ant Design ────────────────────────────────────────────────
// Cuando cambia el modo (light/dark) cambian los tokens semánticos.

const sharedTokens: ThemeConfig["token"] = {
  colorPrimary: BRAND.primary,
  colorSuccess: BRAND.success,
  colorWarning: BRAND.warning,
  colorError: BRAND.error,
  colorInfo: BRAND.info,

  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyCode:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',

  borderRadius: 8,
  borderRadiusLG: 12,
  borderRadiusSM: 6,

  fontSize: 14,
  fontSizeHeading1: 30,
  fontSizeHeading2: 24,
  fontSizeHeading3: 20,
  fontSizeHeading4: 16,
  fontSizeHeading5: 14,

  controlHeight: 36,
  controlHeightSM: 30,
  controlHeightLG: 44,

  wireframe: false,
  motion: true,
};

export const lightTheme: ThemeConfig = {
  cssVar: { key: "ant-light" },
  hashed: false,
  token: {
    ...sharedTokens,
    colorBgBase: "#FAFAF7",            // Marfil cálido suave
    colorBgContainer: "#FFFFFF",
    colorBgLayout: "#F4F4F0",
    colorBgElevated: "#FFFFFF",
    colorBgSpotlight: "#FFFBEB",

    colorTextBase: "#1F2937",
    colorText: "#1F2937",
    colorTextSecondary: "#4B5563",
    colorTextTertiary: "#6B7280",
    colorTextQuaternary: "#9CA3AF",

    colorBorder: "#E5E7EB",
    colorBorderSecondary: "#F3F4F6",

    colorFillAlter: "#F9FAFB",
    colorFill: "#F3F4F6",
    colorFillSecondary: "#F9FAFB",
    colorFillTertiary: "#FAFAFA",
    colorFillQuaternary: "#FCFCFC",

    boxShadowSecondary:
      "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
  },
  components: {
    Layout: {
      headerBg: "#FFFFFF",
      siderBg: "#F8F8F4",
      bodyBg: "#F4F4F0",
      headerPadding: "0 24px",
    },
    Menu: {
      itemBg: "transparent",
      subMenuItemBg: "transparent",
      itemSelectedBg: "#EEF2FF",
      itemSelectedColor: "#4338CA",
      itemHoverBg: "#F3F4F6",
      itemBorderRadius: 8,
      itemMarginInline: 8,
      iconSize: 18,
    },
    Card: {
      boxShadowTertiary:
        "0 1px 2px rgba(0,0,0,0.04), 0 1px 6px -1px rgba(0,0,0,0.04)",
    },
    Table: {
      headerBg: "#FAFAFA",
      headerSplitColor: "transparent",
      rowHoverBg: "#F9FAFB",
    },
    Tag: {
      defaultBg: "#F3F4F6",
    },
    Button: {
      primaryShadow: "none",
      defaultShadow: "none",
    },
  },
};

export const darkTheme: ThemeConfig = {
  cssVar: { key: "ant-dark" },
  hashed: false,
  algorithm: undefined, // usamos override manual de tokens (más control)
  token: {
    ...sharedTokens,
    colorBgBase: "#0A0A0B",
    colorBgContainer: "#111114",
    colorBgLayout: "#08080A",
    colorBgElevated: "#16161A",
    colorBgSpotlight: "#1E1E24",

    colorTextBase: "#E5E7EB",
    colorText: "#E5E7EB",
    colorTextSecondary: "#9CA3AF",
    colorTextTertiary: "#6B7280",
    colorTextQuaternary: "#4B5563",

    colorBorder: "#27272A",
    colorBorderSecondary: "#1F1F23",

    colorFillAlter: "#16161A",
    colorFill: "#1E1E24",
    colorFillSecondary: "#16161A",
    colorFillTertiary: "#131316",
    colorFillQuaternary: "#0F0F12",

    boxShadowSecondary:
      "0 1px 2px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.25)",
  },
  components: {
    Layout: {
      headerBg: "#0E0E11",
      siderBg: "#0B0B0E",
      bodyBg: "#08080A",
      headerPadding: "0 24px",
    },
    Menu: {
      itemBg: "transparent",
      subMenuItemBg: "transparent",
      itemSelectedBg: "rgba(99,102,241,0.16)",
      itemSelectedColor: "#A5B4FC",
      itemHoverBg: "#1A1A1F",
      itemBorderRadius: 8,
      itemMarginInline: 8,
      iconSize: 18,
    },
    Card: {
      boxShadowTertiary: "0 1px 2px rgba(0,0,0,0.5)",
    },
    Table: {
      headerBg: "#131316",
      headerSplitColor: "transparent",
      rowHoverBg: "#16161A",
    },
    Tag: {
      defaultBg: "#1E1E24",
    },
    Button: {
      primaryShadow: "none",
      defaultShadow: "none",
    },
    Input: {
      colorBgContainer: "#131316",
    },
    Select: {
      colorBgContainer: "#131316",
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getPeriodColor(code: string): string {
  return PERIOD_COLORS[code] ?? "#6B7280";
}

export function getCategoryColor(code: string): string {
  return CATEGORY_COLORS[code] ?? "#6B7280";
}
