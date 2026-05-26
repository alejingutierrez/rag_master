"use client";

import Link from "next/link";
import { Skeleton, Tooltip } from "@/components/ui";
import { PERIOD_OPTIONS } from "@/lib/taxonomy";
import { periodCssVar } from "@/lib/design-tokens";

interface Props {
  data: Array<{ code: string; count: number }>;
  loading?: boolean;
}

/**
 * Barra horizontal stacked: cada período como segmento ancho proporcional
 * a su número de preguntas. Click → /questions?periodo=CODE.
 */
export function PeriodDistributionBar({ data, loading }: Props) {
  if (loading) {
    return <Skeleton className="w-full h-20" />;
  }

  const counts = Object.fromEntries(data.map((d) => [d.code, d.count]));
  const total = data.reduce((a, b) => a + b.count, 0);

  return (
    <div>
      {/* Barra principal */}
      <div className="h-7 flex rounded-md overflow-hidden bg-[var(--bg-muted)] mb-4">
        {PERIOD_OPTIONS.map((p) => {
          const count = counts[p.code] ?? 0;
          if (count === 0) return null;
          const widthPct = total > 0 ? (count / total) * 100 : 0;
          return (
            <Tooltip
              key={p.code}
              content={
                <div>
                  <div className="font-semibold">{p.nombre}</div>
                  <div className="text-[11px] opacity-85">{p.rango}</div>
                  <div className="mt-1">{count} preguntas</div>
                </div>
              }
            >
              <Link
                href={`/questions?periodo=${p.code}`}
                className="block opacity-85 hover:opacity-100 transition-opacity"
                style={{
                  width: `${widthPct}%`,
                  background: periodCssVar(p.code),
                }}
                aria-label={`${p.nombre}: ${count} preguntas`}
              />
            </Tooltip>
          );
        })}
      </div>

      {/* Mini grid de cada período */}
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        {PERIOD_OPTIONS.map((p) => {
          const count = counts[p.code] ?? 0;
          const color = periodCssVar(p.code);
          const hasContent = count > 0;
          return (
            <Link
              key={p.code}
              href={`/questions?periodo=${p.code}`}
              className="flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-md border transition-opacity hover:opacity-100"
              style={{
                background: hasContent
                  ? `color-mix(in oklab, ${color} 8%, transparent)`
                  : "var(--bg-muted)",
                borderColor: hasContent
                  ? `color-mix(in oklab, ${color} 20%, transparent)`
                  : "var(--border-default)",
                opacity: hasContent ? 1 : 0.55,
              }}
            >
              <div className="min-w-0 flex-1">
                <div
                  className="text-[11px] font-semibold truncate"
                  style={{
                    color: hasContent ? color : "var(--fg-muted)",
                  }}
                >
                  {p.nombre}
                </div>
                <div className="text-[10px] text-[var(--fg-subtle)]">{p.rango}</div>
              </div>
              <span
                className="text-[13px] font-semibold tabular-nums"
                style={{ color: hasContent ? color : "var(--fg-subtle)" }}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
