"use client";

import dayjs from "@/lib/dayjs-config";

interface DayActivity {
  day: string;
  docs: number;
  questions: number;
  deliverables: number;
}

interface Props {
  data: DayActivity[];
}

/**
 * Sparkline simple en SVG: tres líneas (docs / preguntas / producciones)
 * sobre los últimos 14 días. Cero dependencias de charts pesados.
 */
export function ActivitySparkline({ data }: Props) {
  if (!data.length) {
    return (
      <div className="h-[220px] flex items-center justify-center">
        <span className="text-sm text-[var(--fg-subtle)]">
          Sin actividad reciente
        </span>
      </div>
    );
  }

  const W = 800;
  const H = 200;
  const padX = 32;
  const padY = 24;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [d.docs, d.questions, d.deliverables]),
  );

  const xFor = (i: number) => padX + (i / Math.max(1, data.length - 1)) * innerW;
  const yFor = (v: number) => padY + innerH - (v / maxVal) * innerH;

  const seriesPath = (key: "docs" | "questions" | "deliverables") => {
    return data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d[key])}`)
      .join(" ");
  };

  const seriesArea = (key: "docs" | "questions" | "deliverables") => {
    const path = data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d[key])}`)
      .join(" ");
    return `${path} L ${xFor(data.length - 1)} ${padY + innerH} L ${xFor(0)} ${padY + innerH} Z`;
  };

  const SERIES = [
    { key: "docs" as const, label: "Documentos", colorVar: "--accent" },
    { key: "questions" as const, label: "Preguntas", colorVar: "--color-warning-fg" },
    { key: "deliverables" as const, label: "Producciones", colorVar: "--color-category-cul" },
  ];

  return (
    <div>
      <div className="flex items-center gap-5 mb-3.5 text-xs">
        {SERIES.map((s) => {
          const total = data.reduce((a, d) => a + d[s.key], 0);
          return (
            <div key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-sm"
                style={{ background: `var(${s.colorVar})` }}
              />
              <span className="text-[var(--fg-muted)]">{s.label}</span>
              <span className="font-semibold text-[var(--fg-default)] tabular-nums">
                {total}
              </span>
            </div>
          );
        })}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[200px] block"
        preserveAspectRatio="none"
      >
        <defs>
          {SERIES.map((s) => (
            <linearGradient
              key={s.key}
              id={`grad-${s.key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={`var(${s.colorVar})`} stopOpacity={0.18} />
              <stop offset="100%" stopColor={`var(${s.colorVar})`} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map((t) => {
          const y = padY + innerH * t;
          return (
            <line
              key={t}
              x1={padX}
              x2={W - padX}
              y1={y}
              y2={y}
              stroke="var(--border-default)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          );
        })}

        {/* Areas */}
        {SERIES.map((s) => (
          <path
            key={`area-${s.key}`}
            d={seriesArea(s.key)}
            fill={`url(#grad-${s.key})`}
          />
        ))}

        {/* Lines */}
        {SERIES.map((s) => (
          <path
            key={`line-${s.key}`}
            d={seriesPath(s.key)}
            fill="none"
            stroke={`var(${s.colorVar})`}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* X labels: cada 3 días */}
        {data.map((d, i) => {
          if (i % 3 !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={d.day}
              x={xFor(i)}
              y={H - 4}
              textAnchor="middle"
              fontSize={10}
              fill="var(--fg-subtle)"
            >
              {dayjs(d.day).format("DD MMM")}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
