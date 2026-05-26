# Implementation

Cómo se traducen los tokens del sistema a código. **Esto no es la
implementación**; es la **referencia técnica** de cómo se vería cuando
arranquemos.

Mantenemos este documento para que, al momento de codear, no haya
ambigüedad sobre forma técnica de los tokens.

> ⚠️ **Nada de este código está aplicado en el repo todavía.**
> Es preview. La implementación real es un trabajo futuro — ver
> [Roadmap](#roadmap) al final.

---

## Stack técnico recomendado

| Capa                | Elección                                                  | Por qué                                                              |
| ------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| Framework UI        | Next.js 16 (ya en uso)                                    | No cambia                                                            |
| CSS                 | **Tailwind CSS v4**                                        | Tokens vía CSS variables nativas, sin config JS                       |
| Componentes base    | **Radix Primitives** (headless)                            | Accesibles, sin estilo prescripto                                    |
| Iconos              | **lucide-react**                                           | Line-based, consistentes, MIT                                        |
| Tema (dark/light)   | **next-themes**                                            | SSR-safe, sin flash                                                  |
| Toasts              | **sonner**                                                 | Simple, accesible, sin estilo prescripto                              |
| Command palette     | **cmdk**                                                   | Vercel-tier, accesible                                               |
| Fechas / formatos   | **date-fns** + `Intl.*` API                                | Tree-shakable                                                        |
| Charts              | Reusar AntV G2/G6 si funcionan; o migrar a Recharts/Visx | Decisión separada — ver § Charts                                     |
| Markdown rendering  | **react-markdown** + remark/rehype plugins                 | Para respuestas RAG                                                   |

### Lo que SE ELIMINA

- `antd` y `@ant-design/*` packages (~370KB gzip removidos)
- `@ant-design/charts` (reemplazar o conservar selectivo)

---

## Tailwind v4 — config preview

Tailwind v4 reemplazó `tailwind.config.js` por configuración en CSS
con `@theme`. Esto encaja muy bien con nuestro sistema de tokens.

### `app/globals.css` (preview de lo que sería)

```css
@import "tailwindcss";

/* ============================================================
 * Crónica Design System — tokens
 * Documentación: /docs/design-system/foundations.md
 * ========================================================== */

@theme {
  /* ── Tipografía ─────────────────────────────────────────── */
  --font-serif: "Newsreader", Georgia, "Times New Roman", serif;
  --font-sans: "IBM Plex Sans", system-ui, -apple-system, sans-serif;
  --font-mono: "IBM Plex Mono", "SF Mono", Consolas, monospace;

  /* Escala tipográfica */
  --text-micro: 11px;
  --text-xs: 12px;
  --text-sm: 13px;
  --text-body: 15px;
  --text-body-lg: 17px;
  --text-h5: 16px;
  --text-h4: 18px;
  --text-h3: 22px;
  --text-h2: 28px;
  --text-h1: 36px;
  --text-display: 48px;

  /* Line heights */
  --leading-display: 1.05;
  --leading-h1: 1.15;
  --leading-h2: 1.20;
  --leading-h3: 1.25;
  --leading-h4: 1.30;
  --leading-h5: 1.35;
  --leading-body-lg: 1.65;
  --leading-body: 1.55;
  --leading-sm: 1.50;
  --leading-xs: 1.45;
  --leading-micro: 1.40;

  /* ── Espaciado ──────────────────────────────────────────── */
  --spacing-0: 0;
  --spacing-0_5: 2px;
  --spacing-1: 4px;
  --spacing-1_5: 6px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;
  --spacing-20: 80px;
  --spacing-24: 96px;

  /* ── Radios ────────────────────────────────────────────── */
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-full: 9999px;

  /* ── Containers ────────────────────────────────────────── */
  --container-reading: 680px;
  --container-prose: 760px;
  --container-page: 1080px;
  --container-wide: 1440px;

  /* ── Duraciones ────────────────────────────────────────── */
  --duration-instant: 75ms;
  --duration-fast: 150ms;
  --duration-base: 220ms;
  --duration-slow: 320ms;
  --duration-deliberate: 500ms;

  /* ── Easings ───────────────────────────────────────────── */
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ============================================================
 * Color tokens — duales (light + dark)
 * ========================================================== */

:root {
  /* ── Neutros (ink) ─────────────────────────────────────── */
  --color-ink-0: #FFFFFF;
  --color-ink-25: #FAFAFB;
  --color-ink-50: #F5F5F7;
  --color-ink-100: #EDEEF0;
  --color-ink-200: #DFE1E5;
  --color-ink-300: #C5C8CE;
  --color-ink-400: #9CA1AB;
  --color-ink-500: #71767F;
  --color-ink-600: #565A63;
  --color-ink-700: #3D4148;
  --color-ink-800: #272A30;
  --color-ink-900: #16181C;
  --color-ink-1000: #08090B;

  /* ── Acento signature (tinta) ──────────────────────────── */
  --color-tinta-50: #EFF3F8;
  --color-tinta-100: #DCE5EF;
  --color-tinta-200: #B6C7DC;
  --color-tinta-300: #88A2C0;
  --color-tinta-400: #5878A0;
  --color-tinta-500: #345887;
  --color-tinta-600: #264273;
  --color-tinta-700: #1E3A5F;   /* signature */
  --color-tinta-800: #162F4F;
  --color-tinta-900: #0F2440;
  --color-tinta-950: #0A1B30;

  /* ── Acento secundario (monte) ─────────────────────────── */
  --color-monte-100: #E1ECE6;
  --color-monte-500: #3D7059;
  --color-monte-700: #2D5F3F;

  /* ── Periods ───────────────────────────────────────────── */
  --color-period-pre:     #B45309;
  --color-period-con:     #92400E;
  --color-period-col:     #78350F;
  --color-period-pre-ind: #A16207;
  --color-period-ind:     #1E40AF;
  --color-period-ngr:     #1D4ED8;
  --color-period-euc:     #2563EB;
  --color-period-reg:     #7C2D12;
  --color-period-rep-lib: #0F766E;
  --color-period-vio:     #991B1B;
  --color-period-fn:      #4F46E5;
  --color-period-cna:     #7C3AED;
  --color-period-c91:     #DB2777;
  --color-period-sde:     #0891B2;
  --color-period-pos:     #059669;
  --color-period-trans:   #6B7280;

  /* ── Categorías ─────────────────────────────────────────── */
  --color-category-pol: #1E40AF;
  --color-category-eco: #059669;
  --color-category-con: #DC2626;
  --color-category-soc: #D97706;
  --color-category-cul: #7C3AED;
  --color-category-rel: #0891B2;
  --color-category-ter: #65A30D;
  --color-category-mov: #DB2777;
  --color-category-ins: #475569;
  --color-category-his: #A855F7;

  /* ── Semánticos ────────────────────────────────────────── */
  --color-success-bg: #E6F4EC;
  --color-success-fg: #0E7B43;
  --color-warning-bg: #FBF1DC;
  --color-warning-fg: #A36A05;
  --color-danger-bg:  #FBE7E7;
  --color-danger-fg:  #B42323;
  --color-info-bg:    #E5EDF7;
  --color-info-fg:    #2A5A95;

  /* ── Roles semánticos (consumir estos en componentes) ─── */
  --color-bg-page: var(--color-ink-0);
  --color-bg-subtle: var(--color-ink-25);
  --color-bg-muted: var(--color-ink-50);
  --color-bg-hover: var(--color-ink-100);
  --color-bg-inverted: var(--color-ink-900);

  --color-fg-default: var(--color-ink-900);
  --color-fg-muted: var(--color-ink-700);
  --color-fg-subtle: var(--color-ink-500);
  --color-fg-disabled: var(--color-ink-400);
  --color-fg-inverted: var(--color-ink-0);

  --color-border-default: var(--color-ink-200);
  --color-border-strong: var(--color-ink-300);

  --color-accent: var(--color-tinta-700);
  --color-accent-hover: var(--color-tinta-800);
  --color-accent-bg-subtle: var(--color-tinta-50);
  --color-accent-bg-strong: var(--color-tinta-100);
}

.dark {
  /* ── Neutros (ink) dark ────────────────────────────────── */
  --color-ink-0: #0A0B0D;
  --color-ink-25: #101216;
  --color-ink-50: #16181D;
  --color-ink-100: #1D2026;
  --color-ink-200: #262A31;
  --color-ink-300: #363B44;
  --color-ink-400: #4D525C;
  --color-ink-500: #6C7280;
  --color-ink-600: #8A8F98;
  --color-ink-700: #A7ABB3;
  --color-ink-800: #C5C8CE;
  --color-ink-900: #E1E3E7;
  --color-ink-1000: #F5F6F8;

  /* ── Tinta dark ────────────────────────────────────────── */
  --color-tinta-50: #0F1620;
  --color-tinta-100: #162338;
  --color-tinta-200: #1F3252;
  --color-tinta-300: #2C4470;
  --color-tinta-400: #3F5A8C;
  --color-tinta-500: #5B7AAE;
  --color-tinta-600: #7991C0;
  --color-tinta-700: #94A8CE;   /* signature dark */
  --color-tinta-800: #B0BFDC;
  --color-tinta-900: #CDD7E8;
  --color-tinta-950: #E2E8F2;

  /* ── Periods dark (recalibrados para contraste sobre ink-0 dark) ── */
  --color-period-pre:     #E8995F;
  --color-period-con:     #D88860;
  --color-period-col:     #C97A55;
  --color-period-pre-ind: #DBA653;
  --color-period-ind:     #7A9CE8;
  --color-period-ngr:     #7A99E8;
  --color-period-euc:     #7AA8E8;
  --color-period-reg:     #D88060;
  --color-period-rep-lib: #5FB3A9;
  --color-period-vio:     #E07A7A;
  --color-period-fn:      #9B95F0;
  --color-period-cna:     #B399F0;
  --color-period-c91:     #F08AB3;
  --color-period-sde:     #5FBED8;
  --color-period-pos:     #5FBE96;
  --color-period-trans:   #9CA3AF;

  /* ── Categorías dark ───────────────────────────────────── */
  --color-category-pol: #7A9CE8;
  --color-category-eco: #5FBE96;
  --color-category-con: #F08585;
  --color-category-soc: #E8995F;
  --color-category-cul: #B399F0;
  --color-category-rel: #5FBED8;
  --color-category-ter: #9DC95E;
  --color-category-mov: #F08AB3;
  --color-category-ins: #94A3B8;
  --color-category-his: #C99FF6;

  /* ── Semánticos dark ───────────────────────────────────── */
  --color-success-bg: #0F2A1C;
  --color-success-fg: #5FBE96;
  --color-warning-bg: #2C2110;
  --color-warning-fg: #E8B660;
  --color-danger-bg:  #2C1010;
  --color-danger-fg:  #E88585;
  --color-info-bg:    #101C2C;
  --color-info-fg:    #7A9CE8;
}

/* ============================================================
 * Base styles
 * ========================================================== */

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  background: var(--color-bg-page);
  color: var(--color-fg-default);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

::selection {
  background: color-mix(in oklab, var(--color-accent) 30%, transparent);
}

:focus-visible {
  outline: 2px solid var(--color-tinta-300);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  .shimmer, .stream-caret { animation-duration: revert !important; }
}
```

---

## Theme Provider preview

Con `next-themes`:

```tsx
// app/providers.tsx
"use client";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="cronica-theme"
      disableTransitionOnChange={false}
    >
      {children}
    </ThemeProvider>
  );
}
```

```tsx
// app/layout.tsx
import { Providers } from "./providers";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## Font loading preview

```tsx
// app/layout.tsx
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-serif",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
```

---

## Estructura de carpetas propuesta

```
src/
├── app/                          # Next.js pages (sin cambios estructurales)
├── components/
│   ├── ui/                       # Primitivos (Button, Input, Tooltip, etc.)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── tooltip.tsx
│   │   ├── ...
│   │   └── index.ts              # Barrel export
│   ├── domain/                   # Componentes de dominio
│   │   ├── period-badge.tsx
│   │   ├── citation.tsx
│   │   ├── source-card.tsx
│   │   ├── conversation-bubble.tsx
│   │   ├── ...
│   │   └── index.ts
│   ├── layout/                   # App shell, sidebar, topbar
│   │   ├── app-shell.tsx
│   │   ├── top-bar.tsx
│   │   ├── sidebar.tsx
│   │   └── theme-toggle.tsx
│   └── patterns/                 # Composiciones de página
│       ├── dashboard.tsx
│       ├── conversation-view.tsx
│       ├── reading-view.tsx
│       └── timeline-view.tsx
├── lib/
│   ├── design-tokens.ts          # Si necesitamos tokens en JS (period helpers)
│   └── ...
└── styles/
    └── globals.css               # Tokens + base styles
docs/
└── design-system/                # ← este sistema (verdad única)
```

---

## Patrón de implementación de componente

Cada componente sigue esta estructura:

```tsx
// components/ui/button.tsx
import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonStyles = cva(
  // base
  "inline-flex items-center justify-center gap-2 font-medium " +
  "transition-colors duration-instant ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta-300 focus-visible:ring-offset-2 " +
  "disabled:opacity-45 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-tinta-700 text-ink-0 hover:bg-tinta-800",
        secondary: "bg-ink-0 text-ink-900 border border-ink-200 hover:bg-ink-100 hover:border-ink-300",
        ghost: "text-ink-900 hover:bg-ink-100",
        link: "text-tinta-700 hover:text-tinta-800 underline-offset-4 hover:underline",
        danger: "bg-danger-fg text-ink-0 hover:bg-opacity-90",
      },
      size: {
        sm: "h-7 px-2.5 text-xs rounded-md",
        md: "h-9 px-3.5 text-sm rounded-md",
        lg: "h-11 px-4.5 text-body rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonStyles({ variant, size }), className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && <Spinner className="size-4" aria-hidden />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
```

**Convenciones:**

- `class-variance-authority` (cva) para variantes.
- `cn()` helper (clsx + tailwind-merge).
- `forwardRef` siempre.
- Props extienden HTML primitive correspondiente.
- `displayName` para debugging.
- Sin barrels que importen TODO el dir; barrel exporta intencionalmente.

---

## Charts

**Decisión separada del DS.**

Opciones:
- A) Mantener AntV G2/G6, override de tokens manualmente.
- B) Migrar a Visx + D3 (más control, más trabajo).
- C) Recharts (más simple, menos control).

Decisión: **(A) por ahora, evaluar (B) en fase posterior**. Razones:
- Timeline y grafo actuales funcionan razonablemente
- Override de tokens en AntV es viable
- Migrar charts es bug-prone y requiere QA visual exhaustivo

Cuando migremos, los colors de período/categoría se pasan vía tokens
CSS (en `style` o vía props), no hardcoded.

---

## Roadmap

Fases de migración. **No es un plan detallado de tareas**; es la
secuencia recomendada para que el proyecto siga funcional durante la
transición.

### Fase 0 — Documentación (esto) ✅

- [x] Sistema documentado en `docs/design-system/`
- [ ] Review con stakeholder (vos)
- [ ] Ajustes basados en feedback

### Fase 1 — Setup técnico

- Instalar Tailwind v4
- Instalar `next-themes`, Radix Primitives, lucide-react, cmdk, sonner,
  cva, clsx, tailwind-merge
- Configurar fonts: Newsreader, IBM Plex Sans, IBM Plex Mono
- Crear `globals.css` con tokens (preview de arriba)
- Configurar `ThemeProvider` en `app/layout.tsx`
- Configurar `cn()` helper

**Criterio de éxito:** una página de test renderiza con los tokens
nuevos coexistiendo con Ant. Light y dark funcionan sin flash.

### Fase 2 — Primitivos (los 6 críticos primero)

Implementar en orden:

1. `Button` (más usado)
2. `Input` + `Textarea`
3. `Tooltip` (CRÍTICO — soluciona problema actual)
4. `Card`
5. `Dialog` + `Drawer`
6. `DropdownMenu`

Cada uno con: variantes, todos los estados, tests de accesibilidad,
preview en Storybook (opcional pero recomendado).

**Criterio de éxito:** una página tipo "Components Showcase"
en `/dev/components` muestra los 6 en light y dark, todos accesibles.

### Fase 3 — Layout

- `TopBar` nuevo (reemplaza el header Ant)
- `Sidebar` nuevo (reemplaza Menu Ant)
- `AppShell` recompuesto
- `ThemeToggle` funcional
- `CommandPalette` con cmdk

**Criterio de éxito:** la app shell completa funciona sin Ant Layout.
Algunas páginas internas pueden seguir con Ant temporalmente.

### Fase 4 — Componentes de dominio

- `PeriodBadge` + `CategoryChip`
- `Citation`
- `SourceCard`
- `ConversationBubble`
- `StreamingResponse`
- `ResearchHeader`

**Criterio de éxito:** el viewer de conversaciones se ve con el
nuevo estilo end-to-end.

### Fase 5 — Páginas/Patrones

Una página por iteración, en este orden:

1. Dashboard (Home)
2. Conversation View
3. Reading View
4. Search Results
5. Timeline View
6. Graph View
7. Settings

Cada iteración: rediseño con patterns + componentes nuevos.

### Fase 6 — Cleanup

- Remover `antd`, `@ant-design/*`, `@ant-design/charts` (si charts ya
  migrados)
- Remover `theme.ts` antiguo (sobrevive como referencia en
  `lib/design-tokens.ts` solo con helpers de períodos/categorías)
- Reducir `globals.css` a lo nuevo
- Auditoría de bundle size
- QA full app, light + dark + mobile

### Estimación rough

- Fase 0: hecho hoy
- Fase 1: 1 día
- Fase 2: 3–4 días
- Fase 3: 2 días
- Fase 4: 2 días
- Fase 5: 5–7 días (la más larga)
- Fase 6: 1 día

**Total estimado:** 14–18 días de trabajo focal de implementación.

---

## Decisiones que aún hay que tomar

Cosas que el sistema no decide y dependen de la implementación:

1. **Sistema de logos.** El producto no tiene logo todavía. Mientras
   tanto, wordmark "Archivo Histórico" en Newsreader semibold. Logo
   propio se diseña aparte cuando haya tiempo.
2. **Ilustración del 404 / empty states.** El sistema dice "iconografía
   abstracta" pero no especifica cuál. Decisión visual diferida.
3. **Modelo de tipografía para gráficos.** Si los charts usan
   etiquetas, ¿son sans (Plex) o mono (Plex Mono)? Default sans.
4. **Estrategia de animación de transición entre páginas.** Default es
   sin animación. Si se decide animar, definir en sección Motion
   futura.
5. **Sonidos.** No hay. (Aclaración explícita.)

---

## Mantenimiento del sistema

Reglas para que el sistema no se degrade:

- **Nada se agrega sin documentarse primero.** Componente nuevo
  → entrada en `components.md` → implementación.
- **PR de componente** referencia la sección del sistema que cumple.
- **Auditoría trimestral:** review de tokens y componentes vs uso real.
  Tokens no usados se eliminan; uso ad-hoc que se repite se promueve a
  token.
- **Cambio de token** (ej. ajustar `tinta-700`): se cambia en
  `globals.css` Y se actualiza este documento en la misma PR.

---

## Próximo paso

Cuando vos decidás arrancar la implementación: **Fase 1**. Lo más
rápido es:

1. Crear branch `feat/design-system-setup`.
2. `npm install` de las dependencias listadas arriba.
3. Crear `app/globals.css` con los tokens.
4. Crear página `/dev/tokens` que renderice swatches de todos los
   tokens para validar visualmente.
5. Mostrar a stakeholder, ajustar, merge.

Ahí ya estamos listos para empezar componentes.
