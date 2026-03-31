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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Por categoria */}
      <div className="bg-surface border border-border rounded-lg px-4 py-3">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Por Categoria
        </h3>
        <div className="space-y-1.5">
          {stats.byCategoria.slice(0, 6).map((c) => {
            const color = getCategoryColor(c.code);
            const max = stats.byCategoria[0]?.count ?? 1;
            const pct = Math.round((c.count / max) * 100);
            return (
              <div key={c.code} className="flex items-center gap-2">
                <span className={cn("text-[11px] font-mono min-w-[2.5rem] font-medium", color.text)}>
                  {c.code}
                </span>
                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className={cn("h-full rounded-full", color.bar)} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground min-w-[1.5rem] text-right font-mono">
                  {c.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Por periodo */}
      <div className="bg-surface border border-border rounded-lg px-4 py-3">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Por Periodo
        </h3>
        <div className="space-y-1.5">
          {stats.byPeriodo.slice(0, 6).map((p) => {
            const color = getPeriodColor(p.code);
            const max = stats.byPeriodo[0]?.count ?? 1;
            const pct = Math.round((p.count / max) * 100);
            return (
              <div key={p.code} className="flex items-center gap-2">
                <span className={cn("text-[11px] font-mono min-w-[3.5rem] font-medium", color.text)}>
                  {p.code}
                </span>
                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className={cn("h-full rounded-full", color.bar)} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground min-w-[1.5rem] text-right font-mono">
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
