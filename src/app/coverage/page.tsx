"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  Typography,
  Space,
  Tag,
  Skeleton,
  theme,
  Segmented,
  Tooltip,
  Empty,
} from "antd";
import { HeatMapOutlined } from "@ant-design/icons";
import { PERIOD_OPTIONS, CATEGORY_OPTIONS } from "@/lib/taxonomy";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";

const { Title, Text, Paragraph } = Typography;

interface CoverageData {
  questions: Array<{ periodoCode: string; categoriaCode: string; count: number }>;
  deliverables: Array<{ periodoCode: string; categoriaCode: string; count: number }>;
}

export default function CoveragePage() {
  const { token } = theme.useToken();
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<"questions" | "deliverables">("questions");

  useEffect(() => {
    fetch("/api/coverage")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const cellMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!data) return map;
    const rows = metric === "questions" ? data.questions : data.deliverables;
    for (const r of rows) {
      map.set(`${r.periodoCode}::${r.categoriaCode}`, r.count);
    }
    return map;
  }, [data, metric]);

  const maxVal = useMemo(() => {
    let m = 0;
    for (const v of cellMap.values()) if (v > m) m = v;
    return Math.max(1, m);
  }, [cellMap]);

  const periods = PERIOD_OPTIONS.filter((p) => p.code !== "TRANS");

  if (loading || !data) {
    return <div className="app-page-wide"><Skeleton active /></div>;
  }

  return (
    <div className="app-page-wide">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={2} className="serif-title" style={{ margin: 0 }}>
            <HeatMapOutlined /> Heatmap de cobertura temática
          </Title>
          <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0", maxWidth: 720 }}>
            Matriz período × categoría con densidad de contenido. Las celdas vacías son lagunas
            de investigación donde podrías generar más preguntas.
          </Paragraph>
        </div>
        <Segmented
          value={metric}
          onChange={(v) => setMetric(v as "questions" | "deliverables")}
          options={[
            { value: "questions", label: "Preguntas" },
            { value: "deliverables", label: "Producciones" },
          ]}
        />
      </div>

      <Card bordered bodyStyle={{ padding: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 4, minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 220 }} />
                {periods.map((p) => (
                  <th
                    key={p.code}
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      padding: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: getPeriodColor(p.code),
                      height: 140,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Tooltip title={p.rango}>{p.nombre}</Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORY_OPTIONS.map((c) => (
                <tr key={c.code}>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontSize: 12,
                      fontWeight: 500,
                      color: getCategoryColor(c.code),
                      textAlign: "left",
                      borderLeft: `3px solid ${getCategoryColor(c.code)}`,
                      background: token.colorFillQuaternary,
                      borderRadius: 4,
                    }}
                  >
                    {c.nombre}
                  </td>
                  {periods.map((p) => {
                    const key = `${p.code}::${c.code}`;
                    const count = cellMap.get(key) ?? 0;
                    const intensity = count / maxVal;
                    const periodColor = getPeriodColor(p.code);
                    const categoryColor = getCategoryColor(c.code);

                    return (
                      <td key={key}>
                        <Tooltip
                          title={
                            <div>
                              <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                              <div style={{ fontSize: 11 }}>{c.nombre}</div>
                              <div style={{ marginTop: 4 }}>
                                {count} {metric === "questions" ? "preguntas" : "producciones"}
                              </div>
                            </div>
                          }
                        >
                          <Link
                            href={`/questions?periodo=${p.code}&categoria=${c.code}`}
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 6,
                              background:
                                count === 0
                                  ? token.colorFillQuaternary
                                  : `linear-gradient(135deg, ${periodColor}${Math.round(intensity * 255)
                                      .toString(16)
                                      .padStart(2, "0")}, ${categoryColor}${Math.round(intensity * 200)
                                      .toString(16)
                                      .padStart(2, "0")})`,
                              border: count === 0 ? `1px dashed ${token.colorBorderSecondary}` : "none",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: intensity > 0.5 ? "#fff" : token.colorText,
                              fontSize: 11,
                              fontWeight: 600,
                              fontFamily: "var(--font-mono)",
                              transition: "transform 0.1s",
                              textShadow: intensity > 0.4 ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
                            }}
                          >
                            {count > 0 ? count : ""}
                          </Link>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card bordered title="Lagunas detectadas" style={{ marginTop: 16 }}>
        <Space wrap>
          {(() => {
            const gaps: Array<{ p: typeof PERIOD_OPTIONS[number]; c: typeof CATEGORY_OPTIONS[number] }> = [];
            for (const p of periods) {
              for (const c of CATEGORY_OPTIONS) {
                if ((cellMap.get(`${p.code}::${c.code}`) ?? 0) === 0) {
                  gaps.push({ p, c });
                }
              }
            }
            if (gaps.length === 0) {
              return <Text type="secondary">Cobertura completa, sin lagunas.</Text>;
            }
            return gaps.slice(0, 30).map(({ p, c }, i) => (
              <Link key={i} href={`/questions?periodo=${p.code}&categoria=${c.code}`}>
                <Tag
                  style={{
                    border: `1px dashed ${getCategoryColor(c.code)}`,
                    background: "transparent",
                    color: getCategoryColor(c.code),
                  }}
                >
                  {p.nombre} · {c.nombre}
                </Tag>
              </Link>
            ));
          })()}
        </Space>
      </Card>
    </div>
  );
}
