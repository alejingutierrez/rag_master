"use client";

import { getPeriodColor, getCategoryColor } from "./period-colors";
import { cn } from "@/lib/utils";

interface StatsData {
  byCategoria: { code: string; nombre: string; count: number }[];
  byPeriodo: { code: string; nombre: string; count: number }[];
  totalDocuments: number;
  totalQuestions: number;
}

export function QuestionStats({ stats }: { stats: StatsData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Por categoria */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Por Categoria
        </h3>
        <div className="space-y-2.5">
          {stats.byCategoria.slice(0, 8).map((c) => {
            const color = getCategoryColor(c.code);
            const max = stats.byCategoria[0]?.count ?? 1;
            const pct = Math.round((c.count / max) * 100);
            return (
              <div key={c.code} className="flex items-center gap-2">
                <span className={cn("text-xs font-mono min-w-[3rem] font-medium", color.text)}>
                  {c.code}
                </span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", color.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground min-w-[2rem] text-right font-mono">
                  {c.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Por periodo */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Por Periodo Historico
        </h3>
        <div className="space-y-2.5">
          {stats.byPeriodo.slice(0, 8).map((p) => {
            const color = getPeriodColor(p.code);
            const max = stats.byPeriodo[0]?.count ?? 1;
            const pct = Math.round((p.count / max) * 100);
            return (
              <div key={p.code} className="flex items-center gap-2">
                <span className={cn("text-xs font-mono min-w-[4rem] font-medium", color.text)}>
                  {p.code}
                </span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", color.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground min-w-[2rem] text-right font-mono">
                  {p.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
