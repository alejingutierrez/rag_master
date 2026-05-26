"use client";

import {
  PeriodBadge,
  CategoryChip,
  Citation,
  SourceCard,
  ConversationBubble,
  ResearchHeader,
  ProseBlock,
  EntityChip,
} from "@/components/domain";
import { PERIODS, CATEGORIES } from "@/lib/design-tokens";

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
        <h2 className="serif-title text-[28px] leading-tight text-[var(--color-ink-1000)]">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-[var(--fg-muted)] mt-1">{description}</p>
        )}
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Demo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-mono text-[var(--fg-subtle)] uppercase tracking-wider">
        {label}
      </div>
      <div className="flex items-start flex-wrap gap-3 p-6 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-default)]">
        {children}
      </div>
    </div>
  );
}

export default function DomainShowcasePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--fg-default)] font-sans">
      <div className="max-w-[1080px] mx-auto px-8 py-12">
        <header className="mb-12 pb-4 border-b border-[var(--border-default)]">
          <div className="text-[11px] font-mono text-[var(--fg-subtle)] uppercase tracking-wider mb-2">
            Crónica DS · componentes de dominio
          </div>
          <h1 className="serif-title text-[48px] leading-[1.05] text-[var(--color-ink-1000)]">
            Dominio
          </h1>
          <p className="text-[15px] text-[var(--fg-muted)] mt-2 max-w-[60ch]">
            Componentes específicos del dominio: períodos históricos colombianos,
            categorías temáticas, citas, fuentes, prosa académica y entidades
            nombradas.
          </p>
        </header>

        {/* PeriodBadge */}
        <Section
          title="PeriodBadge"
          description="Badge con color del período histórico + label. 16 períodos."
        >
          <Demo label="Subtle (default) — todos los períodos">
            {Object.values(PERIODS).map((p) => (
              <PeriodBadge key={p.code} code={p.code} size="sm" />
            ))}
          </Demo>

          <Demo label="Solid">
            <PeriodBadge code="IND" variant="solid" />
            <PeriodBadge code="VIO" variant="solid" />
            <PeriodBadge code="C91" variant="solid" />
            <PeriodBadge code="POS" variant="solid" />
          </Demo>

          <Demo label="Outline">
            <PeriodBadge code="PRE" variant="outline" />
            <PeriodBadge code="COL" variant="outline" />
            <PeriodBadge code="REP_LIB" variant="outline" />
          </Demo>

          <Demo label="Sizes (con rango de años)">
            <PeriodBadge code="IND" size="xs" showYears />
            <PeriodBadge code="IND" size="sm" showYears />
            <PeriodBadge code="IND" size="md" showYears />
          </Demo>

          <Demo label="Short (sigla)">
            <PeriodBadge code="PRE" short />
            <PeriodBadge code="IND" short />
            <PeriodBadge code="C91" short />
            <PeriodBadge code="POS" short />
          </Demo>
        </Section>

        {/* CategoryChip */}
        <Section
          title="CategoryChip"
          description="Chips de categoría temática. 10 categorías."
        >
          <Demo label="Subtle (default)">
            {Object.values(CATEGORIES).map((c) => (
              <CategoryChip key={c.code} code={c.code} size="sm" />
            ))}
          </Demo>

          <Demo label="Outline">
            <CategoryChip code="POL" variant="outline" />
            <CategoryChip code="ECO" variant="outline" />
            <CategoryChip code="MOV" variant="outline" />
          </Demo>

          <Demo label="Solid">
            <CategoryChip code="POL" variant="solid" />
            <CategoryChip code="CON" variant="solid" />
            <CategoryChip code="HIS" variant="solid" />
          </Demo>
        </Section>

        {/* EntityChip */}
        <Section
          title="EntityChip"
          description="Personas, lugares, instituciones, eventos."
        >
          <Demo label="Tipos">
            <EntityChip type="person" name="Simón Bolívar" year="1783–1830" />
            <EntityChip type="place" name="Cartagena de Indias" />
            <EntityChip type="institution" name="Banco de la República" />
            <EntityChip type="event" name="Bogotazo" year={1948} />
          </Demo>

          <Demo label="Sizes">
            <EntityChip type="person" name="Manuela Sáenz" size="xs" />
            <EntityChip type="person" name="Manuela Sáenz" size="sm" />
            <EntityChip type="person" name="Manuela Sáenz" size="md" />
          </Demo>
        </Section>

        {/* Citation */}
        <Section
          title="Citation"
          description="Marca inline en prosa académica. Click abre fuente."
        >
          <Demo label="En prosa (preview de popover al hover)">
            <p
              className="text-[17px] leading-relaxed max-w-[60ch]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              La Constitución Política de Colombia de 1991 marcó el inicio de
              un nuevo orden institucional
              <Citation
                number={1}
                sourceTitle="Constitución Política de Colombia, 1991"
                meta="Asamblea Nacional Constituyente · 4 de julio de 1991"
                snippet="Colombia es un Estado social de derecho, organizado en forma de República unitaria, descentralizada…"
              />
              . Reemplazó la Carta de 1886 tras un proceso constituyente que
              respondió a la crisis de legitimidad del Estado
              <Citation
                number={2}
                sourceTitle="La Constituyente como respuesta al colapso del Estado"
                meta="Manuel José Cepeda · 1993"
                snippet="La constituyente fue la respuesta política a un Estado colapsado por la violencia y la corrupción."
              />{" "}
              y a la presión por una democracia más participativa.
            </p>
          </Demo>

          <Demo label="Estado activo">
            <p
              className="text-[17px] leading-relaxed max-w-[60ch]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Ver fuente actualmente abierta: <Citation number={42} active />.
            </p>
          </Demo>
        </Section>

        {/* SourceCard */}
        <Section
          title="SourceCard"
          description="Card de fuente bibliográfica. Banda de período + badges."
        >
          <Demo label="Variantes por tipo">
            <SourceCard
              type="book"
              title="Historia de Colombia: La Independencia"
              author="Jorge Orlando Melo"
              year={2017}
              publisher="Crítica"
              snippet="El proceso independentista colombiano se inscribe en el contexto continental, pero presenta características propias…"
              periodCode="IND"
              categoryCodes={["POL", "HIS"]}
              className="w-[420px]"
            />
            <SourceCard
              type="article"
              title="La Constituyente de 1991 y la apertura democrática"
              author="Manuel José Cepeda"
              year={1993}
              publisher="Revista de Derecho Público, n.º 4"
              snippet="La carta de 1991 introdujo mecanismos de participación que rompieron con el régimen presidencialista tradicional."
              periodCode="C91"
              categoryCodes={["POL", "INS"]}
              className="w-[420px]"
            />
          </Demo>

          <Demo label="Más tipos">
            <SourceCard
              type="archive"
              title="Acta de Independencia de Cartagena"
              author="Cabildo de Cartagena"
              year={1811}
              periodCode="IND"
              className="w-[420px]"
            />
            <SourceCard
              type="newspaper"
              title="El Tiempo, edición del 10 de abril de 1948"
              year={1948}
              snippet="Bogotá amaneció en llamas tras el asesinato del líder liberal Jorge Eliécer Gaitán."
              periodCode="VIO"
              categoryCodes={["CON", "SOC"]}
              className="w-[420px]"
            />
          </Demo>
        </Section>

        {/* ResearchHeader */}
        <Section
          title="ResearchHeader"
          description="Header de research artifact (página de respuesta extendida)."
        >
          <Demo label="Completo">
            <div className="w-full bg-[var(--bg-page)] p-6 rounded-md border border-[var(--border-default)]">
              <ResearchHeader
                title="La Constitución de 1991 y el Estado social de derecho"
                subtitle="Una lectura del proceso constituyente desde la crisis institucional de los 80 y la apertura democrática."
                periodCode="C91"
                categoryCodes={["POL", "INS"]}
                meta={[
                  { label: "palabras", value: "2,847" },
                  { label: "fuentes", value: "23" },
                ]}
                breadcrumb={
                  <span>
                    <span className="text-[var(--fg-muted)]">Conversaciones</span>
                    <span className="mx-1.5 text-[var(--fg-subtle)]">›</span>
                    <span className="text-[var(--fg-muted)]">Constitución</span>
                  </span>
                }
              />
            </div>
          </Demo>
        </Section>

        {/* ConversationBubble */}
        <Section
          title="ConversationBubble"
          description="Bubble de chat. User a la derecha (con bg), Assistant full width (prose)."
        >
          <Demo label="Conversación de ejemplo">
            <div className="w-full max-w-3xl bg-[var(--bg-page)] p-6 rounded-md border border-[var(--border-default)]">
              <ConversationBubble from="user">
                ¿Cuándo y por qué se promulgó la Constitución de 1991?
              </ConversationBubble>

              <ConversationBubble from="assistant">
                <p>
                  La Constitución Política de Colombia fue promulgada el{" "}
                  <strong>4 de julio de 1991</strong>, reemplazando la Carta
                  de 1886. Su promulgación respondió a una{" "}
                  <em>crisis de legitimidad</em> profunda del Estado, marcada
                  por la violencia del narcotráfico, los movimientos guerrilleros
                  activos, y un sistema político clientelista
                  <Citation number={1} sourceTitle="Cepeda, 1993" />.
                </p>
                <p>
                  El proceso constituyente fue iniciado por la <strong>séptima
                  papeleta</strong>, un movimiento estudiantil que impulsó una
                  consulta popular en marzo de 1990
                  <Citation number={2} sourceTitle="Melo, 2017" />.
                </p>
              </ConversationBubble>

              <ConversationBubble from="user">
                ¿Cuáles fueron sus innovaciones más importantes?
              </ConversationBubble>

              <ConversationBubble from="assistant" streaming>
                Entre las innovaciones más destacadas se cuentan: el reconocimiento
                del Estado social de derecho, la creación de la
              </ConversationBubble>
            </div>
          </Demo>
        </Section>

        {/* ProseBlock */}
        <Section
          title="ProseBlock"
          description="Wrapper de contenido editorial largo (.prose-academic)."
        >
          <Demo label="Prosa académica">
            <ProseBlock className="w-full bg-[var(--bg-page)] p-8 rounded-md border border-[var(--border-default)]">
              <h2>La Constitución de 1991</h2>
              <p>
                La Constitución Política de Colombia de 1991 marcó el inicio
                de un nuevo orden institucional. Promulgada el 4 de julio,
                reemplazó la Carta de 1886 tras un proceso constituyente que
                respondió a la <em>crisis de legitimidad</em> del Estado
                <span className="citation">12</span> y a la presión por una
                democracia más participativa.
              </p>
              <blockquote>
                «La constituyente fue la respuesta política a un Estado
                colapsado.» — Manuel José Cepeda
              </blockquote>
              <h3>Innovaciones institucionales</h3>
              <p>
                Entre sus innovaciones se cuentan el reconocimiento de la
                diversidad étnica, la creación de la Corte Constitucional, y
                la incorporación de mecanismos como la <strong>acción de
                tutela</strong>.
              </p>
              <ul>
                <li>Estado social de derecho</li>
                <li>Acción de tutela</li>
                <li>Corte Constitucional</li>
                <li>Mecanismos de participación ciudadana</li>
              </ul>
            </ProseBlock>
          </Demo>
        </Section>

        <footer className="mt-16 pt-6 border-t border-[var(--border-default)] text-[11px] font-mono text-[var(--fg-subtle)]">
          Crónica DS · /dev/domain · Documentación en{" "}
          <code>docs/design-system/components.md</code>
        </footer>
      </div>
    </div>
  );
}
