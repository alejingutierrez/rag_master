"use client";

import { theme, Space, Typography } from "antd";
import dayjs from "dayjs";

const { Text } = Typography;

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
  const { token } = theme.useToken();

  if (!data.length) {
    return (
      <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Text type="secondary">Sin actividad reciente</Text>
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
    const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d[key])}`).join(" ");
    return `${path} L ${xFor(data.length - 1)} ${padY + innerH} L ${xFor(0)} ${padY + innerH} Z`;
  };

  const COLORS = {
    docs: token.colorPrimary,
    questions: "#F59E0B",
    deliverables: "#A855F7",
  };

  return (
    <div>
      <Space size={20} style={{ marginBottom: 14, fontSize: 12 }}>
        {(["docs", "questions", "deliverables"] as const).map((key) => {
          const total = data.reduce((a, d) => a + d[key], 0);
          const label = key === "docs" ? "Documentos" : key === "questions" ? "Preguntas" : "Producciones";
          return (
            <Space key={key} size={6}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: COLORS[key],
                  display: "inline-block",
                }}
              />
              <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>{label}</Text>
              <Text style={{ fontSize: 12, fontWeight: 600 }}>{total}</Text>
            </Space>
          );
        })}
      </Space>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: 200, display: "block" }}
        preserveAspectRatio="none"
      >
        <defs>
          {(["docs", "questions", "deliverables"] as const).map((key) => (
            <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS[key]} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLORS[key]} stopOpacity={0} />
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
              stroke={token.colorBorderSecondary}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          );
        })}

        {/* Areas */}
        {(["docs", "questions", "deliverables"] as const).map((key) => (
          <path key={`area-${key}`} d={seriesArea(key)} fill={`url(#grad-${key})`} />
        ))}

        {/* Lines */}
        {(["docs", "questions", "deliverables"] as const).map((key) => (
          <path
            key={`line-${key}`}
            d={seriesPath(key)}
            fill="none"
            stroke={COLORS[key]}
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
              fill={token.colorTextTertiary}
            >
              {dayjs(d.day).format("DD MMM")}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
