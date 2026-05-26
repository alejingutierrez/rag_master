"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import {
  Card,
  Skeleton,
  Tooltip,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { PERIOD_OPTIONS, CATEGORY_OPTIONS } from "@/lib/taxonomy";
import { getPeriodColor, getCategoryColor } from "@/lib/theme";

interface CoverageData {
  questions: Array<{ periodoCode: string; categoriaCode: string; count: number }>;
  deliverables: Array<{ periodoCode: string; categoriaCode: string; count: number }>;
}

export default function CoveragePage() {
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
    return (
      <div className="app-page-wide">
        <Skeleton variant="line" className="h-8 w-72 mb-3" />
        <Skeleton variant="line" className="h-4 w-[480px] mb-6" />
        <Skeleton variant="rect" className="h-[420px] w-full" />
      </div>
    );
  }

  return (
    <div className="app-page-wide">
      <div className="flex justify-between items-end mb-6 flex-wrap gap-3">
        <div>
          <h1
            className="serif-title text-[36px] leading-tight m-0 text-[var(--color-ink-1000)] inline-flex items-center gap-2"
            style={{ fontWeight: 700 }}
          >
            <Flame className="size-7 text-[var(--accent)]" />
            Heatmap de cobertura temática
          </h1>
          <p className="text-[14px] leading-relaxed text-[var(--fg-muted)] mt-1.5 mb-0 max-w-[720px]">
            Matriz período × categoría con densidad de contenido. Las celdas vacías son lagunas
            de investigación donde podrías generar más preguntas.
          </p>
        </div>
        <Tabs
          value={metric}
          onValueChange={(v) => setMetric(v as "questions" | "deliverables")}
        >
          <TabsList variant="segmented">
            <TabsTrigger value="questions" variant="segmented">
              Preguntas
            </TabsTrigger>
            <TabsTrigger value="deliverables" variant="segmented">
              Producciones
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card variant="default" size="md">
        <div className="overflow-x-auto">
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
                    <Tooltip content={p.rango}>
                      <span>{p.nombre}</span>
                    </Tooltip>
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
                      background: "var(--bg-muted)",
                      borderRadius: 4,
                      position: "sticky",
                      left: 0,
                      zIndex: 1,
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
                          content={
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
                                  ? "var(--bg-muted)"
                                  : `linear-gradient(135deg, ${periodColor}${Math.round(intensity * 255)
                                      .toString(16)
                                      .padStart(2, "0")}, ${categoryColor}${Math.round(intensity * 200)
                                      .toString(16)
                                      .padStart(2, "0")})`,
                              border: count === 0 ? "1px dashed var(--border-default)" : "none",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: intensity > 0.5 ? "#fff" : "var(--fg-default)",
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

      <Card variant="default" size="md" className="mt-4">
        <header className="mb-3">
          <h3 className="text-[15px] font-semibold text-[var(--fg-default)] m-0">
            Lagunas detectadas
          </h3>
        </header>
        <div className="flex flex-wrap gap-2">
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
              return (
                <span className="text-sm text-[var(--fg-muted)]">
                  Cobertura completa, sin lagunas.
                </span>
              );
            }
            return gaps.slice(0, 30).map(({ p, c }, i) => (
              <Link
                key={i}
                href={`/questions?periodo=${p.code}&categoria=${c.code}`}
                className="inline-flex items-center gap-1 h-[22px] px-2 text-xs rounded-sm bg-transparent hover:opacity-80 transition-opacity"
                style={{
                  border: `1px dashed ${getCategoryColor(c.code)}`,
                  color: getCategoryColor(c.code),
                }}
              >
                {p.nombre} · {c.nombre}
              </Link>
            ));
          })()}
        </div>
      </Card>
    </div>
  );
}
