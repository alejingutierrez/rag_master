"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/theme-provider";

/* ============================================================================
 * /dev/tokens — Página de validación visual del Crónica Design System
 * Renderiza swatches de todos los tokens: colores, tipografía, espaciado,
 * radios, elevaciones, motion. NO es parte de la app de producción.
 * ========================================================================== */

const inkScale = [
  "0", "25", "50", "100", "200", "300", "400", "500", "600", "700", "800",
  "900", "1000",
];

const tintaScale = [
  "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950",
];

const periods = [
  { code: "pre", label: "Prehispánico" },
  { code: "con", label: "Conquista" },
  { code: "col", label: "Colonia" },
  { code: "pre-ind", label: "Pre-independencia" },
  { code: "ind", label: "Independencia" },
  { code: "ngr", label: "Nueva Granada" },
  { code: "euc", label: "Estados Unidos de Colombia" },
  { code: "reg", label: "Regeneración" },
  { code: "rep-lib", label: "República Liberal" },
  { code: "vio", label: "La Violencia" },
  { code: "fn", label: "Frente Nacional" },
  { code: "cna", label: "Crisis y narcotráfico" },
  { code: "c91", label: "Constitución 1991" },
  { code: "sde", label: "Seguridad Democrática" },
  { code: "pos", label: "Posconflicto" },
  { code: "trans", label: "Transversal" },
];

const categories = [
  { code: "pol", label: "Política" },
  { code: "eco", label: "Economía" },
  { code: "con", label: "Conflicto" },
  { code: "soc", label: "Sociedad" },
  { code: "cul", label: "Cultura" },
  { code: "rel", label: "Relaciones int." },
  { code: "ter", label: "Territorio" },
  { code: "mov", label: "Mov. sociales" },
  { code: "ins", label: "Instituciones" },
  { code: "his", label: "Historiografía" },
];

const semantics = [
  { name: "success", fg: "--color-success-fg", bg: "--color-success-bg" },
  { name: "warning", fg: "--color-warning-fg", bg: "--color-warning-bg" },
  { name: "danger", fg: "--color-danger-fg", bg: "--color-danger-bg" },
  { name: "info", fg: "--color-info-fg", bg: "--color-info-bg" },
];

const typeScale = [
  { name: "display", size: "48px", font: "serif", weight: 700 },
  { name: "h1", size: "36px", font: "serif", weight: 700 },
  { name: "h2", size: "28px", font: "serif", weight: 600 },
  { name: "h3", size: "22px", font: "sans", weight: 600 },
  { name: "h4", size: "18px", font: "sans", weight: 600 },
  { name: "h5", size: "16px", font: "sans", weight: 600 },
  { name: "body-lg", size: "17px", font: "serif", weight: 400 },
  { name: "body", size: "15px", font: "sans", weight: 400 },
  { name: "sm", size: "13px", font: "sans", weight: 400 },
  { name: "xs", size: "12px", font: "sans", weight: 400 },
  { name: "micro", size: "11px", font: "sans", weight: 500 },
];

const spacingScale = [
  { name: "0.5", value: "2px" },
  { name: "1", value: "4px" },
  { name: "1.5", value: "6px" },
  { name: "2", value: "8px" },
  { name: "3", value: "12px" },
  { name: "4", value: "16px" },
  { name: "5", value: "20px" },
  { name: "6", value: "24px" },
  { name: "8", value: "32px" },
  { name: "10", value: "40px" },
  { name: "12", value: "48px" },
  { name: "16", value: "64px" },
];

const radiusScale = [
  { name: "sm", value: "4px" },
  { name: "md", value: "6px" },
  { name: "lg", value: "8px" },
  { name: "xl", value: "12px" },
  { name: "2xl", value: "16px" },
  { name: "full", value: "9999px" },
];

const elevationScale = [
  { name: "1", token: "--elev-1" },
  { name: "2", token: "--elev-2" },
  { name: "3", token: "--elev-3" },
  { name: "4", token: "--elev-4" },
];

const motionScale = [
  { name: "instant", value: "75ms" },
  { name: "fast", value: "150ms" },
  { name: "base", value: "220ms" },
  { name: "slow", value: "320ms" },
  { name: "deliberate", value: "500ms" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <header className="mb-6">
        <h2
          className="serif-title"
          style={{ fontSize: "28px", lineHeight: 1.2 }}
        >
          {title}
        </h2>
        {description && (
          <p
            style={{
              color: "var(--fg-muted)",
              fontSize: "13px",
              marginTop: "4px",
            }}
          >
            {description}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

function ColorSwatch({
  label,
  cssVar,
  hex,
}: {
  label: string;
  cssVar: string;
  hex?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-16 w-full rounded-md"
        style={{
          background: `var(${cssVar})`,
          boxShadow: "inset 0 0 0 1px var(--border-default)",
        }}
      />
      <div className="flex flex-col">
        <span
          style={{
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color: "var(--fg-default)",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        {hex && (
          <span
            style={{
              fontSize: "10px",
              fontFamily: "var(--font-mono)",
              color: "var(--fg-subtle)",
            }}
          >
            {hex}
          </span>
        )}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { mode, resolved, setMode } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Antes del mount, render un placeholder con dimensiones equivalentes
  // para evitar layout shift y hydration mismatch.
  if (!mounted) {
    return <div style={{ width: 280, height: 32 }} aria-hidden />;
  }

  return (
    <div className="flex items-center gap-2">
      <span
        style={{
          fontSize: "11px",
          color: "var(--fg-subtle)",
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Tema actual: {resolved}
      </span>
      <div className="flex gap-1">
        {(["light", "dark", "auto"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: "4px 10px",
              fontSize: "12px",
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-default)",
              background:
                mode === m ? "var(--accent)" : "var(--bg-page)",
              color: mode === m ? "var(--fg-inverted)" : "var(--fg-default)",
              cursor: "pointer",
              transition: "all var(--duration-instant) var(--ease-out-custom)",
            }}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TokensPage() {
  return (
    <div
      style={{
        background: "var(--bg-page)",
        color: "var(--fg-default)",
        minHeight: "100vh",
        padding: "48px 32px",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: "48px",
            paddingBottom: "16px",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                color: "var(--fg-subtle)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
              }}
            >
              Sistema de diseño · v0.1
            </div>
            <h1
              className="serif-title"
              style={{
                fontSize: "48px",
                lineHeight: 1.05,
                margin: 0,
                color: "var(--color-ink-1000)",
              }}
            >
              Crónica
            </h1>
            <p
              style={{
                fontSize: "15px",
                color: "var(--fg-muted)",
                marginTop: "8px",
                maxWidth: "60ch",
              }}
            >
              Tokens visuales del Archivo Histórico Digital. Esta página existe
              para validar la coherencia del sistema en light y dark mode antes
              de implementar componentes.
            </p>
          </div>
          <ThemeToggle />
        </header>

        {/* Tipografía */}
        <Section
          title="Tipografía"
          description="Newsreader (serif) para contenido editorial · IBM Plex Sans (UI) · IBM Plex Mono (data)"
        >
          <div
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              padding: "32px",
              background: "var(--bg-subtle)",
            }}
          >
            {typeScale.map((t) => (
              <div
                key={t.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  gap: "24px",
                  alignItems: "baseline",
                  paddingBottom: "16px",
                  marginBottom: "16px",
                  borderBottom: "1px solid var(--border-default)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--fg-subtle)",
                      fontWeight: 500,
                    }}
                  >
                    text-{t.name}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--fg-subtle)",
                    }}
                  >
                    {t.size} · {t.font} · {t.weight}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: t.size,
                    fontFamily:
                      t.font === "serif"
                        ? "var(--font-serif)"
                        : "var(--font-sans)",
                    fontWeight: t.weight,
                    color: "var(--fg-default)",
                    letterSpacing:
                      t.size === "48px"
                        ? "-0.025em"
                        : t.size === "36px"
                          ? "-0.020em"
                          : "0",
                  }}
                >
                  Crónica de Indias y república
                </div>
              </div>
            ))}
            <div
              style={{
                marginTop: "32px",
                padding: "16px",
                background: "var(--bg-muted)",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                color: "var(--fg-muted)",
              }}
            >
              Mono · const decreto = &quot;1991-07-04&quot;;
            </div>
          </div>
        </Section>

        {/* Neutros */}
        <Section
          title="Neutros — ink"
          description="13 pasos de gris tinta. Backgrounds, superficies, texto, bordes."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "8px",
            }}
          >
            {inkScale.map((step) => (
              <ColorSwatch
                key={step}
                label={`ink-${step}`}
                cssVar={`--color-ink-${step}`}
              />
            ))}
          </div>
        </Section>

        {/* Tinta */}
        <Section
          title="Acento signature — tinta"
          description="El único color de marca. Acciones primarias, focus rings, links. Token signature: tinta-700."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "8px",
            }}
          >
            {tintaScale.map((step) => (
              <ColorSwatch
                key={step}
                label={`tinta-${step}${step === "700" ? " ★" : ""}`}
                cssVar={`--color-tinta-${step}`}
              />
            ))}
          </div>
        </Section>

        {/* Monte */}
        <Section
          title="Acento secundario — monte"
          description="Verde botella sutil. Success contextual, acentos editoriales puntuales (línea bajo title)."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "8px",
            }}
          >
            <ColorSwatch label="monte-100" cssVar="--color-monte-100" />
            <ColorSwatch label="monte-500" cssVar="--color-monte-500" />
            <ColorSwatch label="monte-700" cssVar="--color-monte-700" />
          </div>
        </Section>

        {/* Períodos históricos */}
        <Section
          title="Períodos históricos"
          description="16 colores identitarios. Solo en contextos de dominio (badges, timeline, grafo)."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "12px",
            }}
          >
            {periods.map((p) => (
              <div
                key={p.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "var(--radius-sm)",
                    background: `var(--color-period-${p.code})`,
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--fg-subtle)",
                    }}
                  >
                    period-{p.code}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--fg-default)",
                      fontWeight: 500,
                    }}
                  >
                    {p.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "16px",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {periods.slice(0, 8).map((p) => (
              <span
                key={p.code}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 8px",
                  fontSize: "12px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  borderRadius: "var(--radius-sm)",
                  background: `color-mix(in oklab, var(--color-period-${p.code}) 12%, transparent)`,
                  color: `var(--color-period-${p.code})`,
                }}
              >
                {p.label}
              </span>
            ))}
          </div>
        </Section>

        {/* Categorías */}
        <Section
          title="Categorías temáticas"
          description="10 colores secundarios. Acompañan a períodos, no compiten con ellos."
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {categories.map((c) => (
              <span
                key={c.code}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "5px 12px",
                  fontSize: "13px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  borderRadius: "9999px",
                  background: `color-mix(in oklab, var(--color-category-${c.code}) 12%, transparent)`,
                  color: `var(--color-category-${c.code})`,
                }}
              >
                {c.label}
              </span>
            ))}
          </div>
        </Section>

        {/* Semánticos */}
        <Section
          title="Colores semánticos"
          description="Cuatro estados estrictamente limitados: success, warning, danger, info."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "12px",
            }}
          >
            {semantics.map((s) => (
              <div
                key={s.name}
                style={{
                  padding: "16px",
                  borderRadius: "var(--radius-lg)",
                  background: `var(${s.bg})`,
                  borderLeft: `4px solid var(${s.fg})`,
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: `var(${s.fg})`,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                >
                  {s.name}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: `var(${s.fg})`,
                  }}
                >
                  Mensaje de ejemplo para {s.name}.
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Espaciado */}
        <Section
          title="Espaciado"
          description="Base 4px. Una sola escala compartida."
        >
          <div
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              padding: "16px",
              background: "var(--bg-subtle)",
            }}
          >
            {spacingScale.map((s) => (
              <div
                key={s.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 80px 1fr",
                  gap: "16px",
                  alignItems: "center",
                  padding: "6px 0",
                }}
              >
                <code
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--fg-muted)",
                  }}
                >
                  space-{s.name}
                </code>
                <code
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--fg-subtle)",
                  }}
                >
                  {s.value}
                </code>
                <div
                  style={{
                    height: "16px",
                    width: s.value,
                    background: "var(--accent)",
                    borderRadius: "var(--radius-sm)",
                  }}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Radios */}
        <Section
          title="Border radius"
          description="De tags y kbd hasta drawers."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "16px",
            }}
          >
            {radiusScale.map((r) => (
              <div key={r.name} style={{ textAlign: "center" }}>
                <div
                  style={{
                    height: "80px",
                    background: "var(--color-tinta-100)",
                    borderRadius: r.value,
                    marginBottom: "8px",
                    border: "1px solid var(--color-tinta-200)",
                  }}
                />
                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--fg-default)",
                    fontWeight: 500,
                  }}
                >
                  radius-{r.name}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--fg-subtle)",
                  }}
                >
                  {r.value}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Elevación */}
        <Section
          title="Elevación"
          description="Cuatro niveles. En dark, las sombras se combinan con ring inset."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "24px",
            }}
          >
            {elevationScale.map((e) => (
              <div key={e.name} style={{ textAlign: "center" }}>
                <div
                  style={{
                    height: "100px",
                    background: "var(--bg-page)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: `var(${e.token})`,
                    marginBottom: "12px",
                  }}
                />
                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--fg-default)",
                    fontWeight: 500,
                  }}
                >
                  elev-{e.name}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Motion */}
        <Section
          title="Motion"
          description="Duraciones. Easing default: ease-out (0.2, 0.8, 0.2, 1)."
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "12px",
            }}
          >
            {motionScale.map((m) => (
              <div
                key={m.name}
                style={{
                  padding: "16px",
                  background: "var(--bg-subtle)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--fg-default)",
                    fontWeight: 500,
                    marginBottom: "2px",
                  }}
                >
                  duration-{m.name}
                </div>
                <div
                  style={{
                    fontSize: "16px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--accent)",
                    fontWeight: 600,
                  }}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Prosa muestra */}
        <Section
          title="Prosa académica · muestra"
          description="Ejemplo del aspecto del contenido editorial largo (.prose-academic)."
        >
          <article
            className="prose-academic"
            style={{ background: "var(--bg-subtle)", padding: "32px", borderRadius: "var(--radius-lg)" }}
          >
            <h2>La Constitución de 1991</h2>
            <p>
              La Constitución Política de Colombia de 1991 marcó el inicio
              de un nuevo orden institucional. Promulgada el 4 de julio,
              reemplazó la Carta de 1886 tras un proceso constituyente que
              respondió a la crisis de legitimidad del Estado
              <span className="citation">12</span> y a la presión por una
              democracia más participativa.
            </p>
            <blockquote>
              «La constituyente fue la respuesta política a un Estado
              colapsado.» — Manuel José Cepeda
            </blockquote>
            <p>
              Entre sus innovaciones se cuentan el reconocimiento de la
              diversidad étnica, la creación de la Corte Constitucional, y
              la incorporación de mecanismos como la acción de tutela.
            </p>
          </article>
        </Section>

        <footer
          style={{
            marginTop: "64px",
            paddingTop: "24px",
            borderTop: "1px solid var(--border-default)",
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color: "var(--fg-subtle)",
          }}
        >
          Crónica DS · /dev/tokens · Documentación completa en{" "}
          <code>docs/design-system/</code>
        </footer>
      </div>
    </div>
  );
}
