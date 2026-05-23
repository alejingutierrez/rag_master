"use client";

import Link from "next/link";
import { theme, Skeleton, Tooltip, Typography } from "antd";
import { PERIOD_OPTIONS } from "@/lib/taxonomy";
import { getPeriodColor } from "@/lib/theme";

const { Text } = Typography;

interface Props {
  data: Array<{ code: string; count: number }>;
  loading?: boolean;
}

/**
 * Barra horizontal stacked: cada período como segmento ancho proporcional
 * a su número de preguntas. Click → /questions?periodo=CODE.
 */
export function PeriodDistributionBar({ data, loading }: Props) {
  const { token } = theme.useToken();

  if (loading) {
    return <Skeleton.Input active style={{ width: "100%", height: 80 }} />;
  }

  const counts = Object.fromEntries(data.map((d) => [d.code, d.count]));
  const total = data.reduce((a, b) => a + b.count, 0);

  return (
    <div>
      {/* Barra principal */}
      <div
        style={{
          height: 28,
          display: "flex",
          borderRadius: 6,
          overflow: "hidden",
          background: token.colorFillQuaternary,
          marginBottom: 16,
        }}
      >
        {PERIOD_OPTIONS.map((p) => {
          const count = counts[p.code] ?? 0;
          if (count === 0) return null;
          const widthPct = total > 0 ? (count / total) * 100 : 0;
          return (
            <Tooltip
              key={p.code}
              title={
                <div>
                  <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, opacity: 0.85 }}>{p.rango}</div>
                  <div style={{ marginTop: 4 }}>{count} preguntas</div>
                </div>
              }
            >
              <Link
                href={`/questions?periodo=${p.code}`}
                style={{
                  width: `${widthPct}%`,
                  background: getPeriodColor(p.code),
                  display: "block",
                  transition: "opacity 0.15s",
                  opacity: 0.85,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.85")}
              />
            </Tooltip>
          );
        })}
      </div>

      {/* Mini grid de cada período */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
        {PERIOD_OPTIONS.map((p) => {
          const count = counts[p.code] ?? 0;
          const color = getPeriodColor(p.code);
          return (
            <Link
              key={p.code}
              href={`/questions?periodo=${p.code}`}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                background: count > 0 ? `${color}14` : token.colorFillQuaternary,
                border: `1px solid ${count > 0 ? `${color}33` : token.colorBorderSecondary}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 6,
                opacity: count > 0 ? 1 : 0.55,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: count > 0 ? color : token.colorTextSecondary,
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.nombre}
                </Text>
                <Text style={{ fontSize: 10, color: token.colorTextTertiary }}>{p.rango}</Text>
              </div>
              <Text style={{ fontSize: 13, fontWeight: 600, color: count > 0 ? color : token.colorTextTertiary }}>
                {count}
              </Text>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
