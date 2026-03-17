"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

export interface SearchConfig {
  topK: number;
  similarityThreshold: number;
  maxTokens: number;
}

interface SearchConfigProps {
  config: SearchConfig;
  onChange: (config: SearchConfig) => void;
}

export function SearchConfigPanel({ config, onChange }: SearchConfigProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Parametros de Busqueda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-medium">Top-K resultados</label>
            <span className="text-xs text-neutral-500">{config.topK}</span>
          </div>
          <Slider
            min={1}
            max={20}
            step={1}
            value={config.topK}
            onValueChange={(v) => onChange({ ...config, topK: v })}
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-medium">Umbral similitud</label>
            <span className="text-xs text-neutral-500">{config.similarityThreshold.toFixed(2)}</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={config.similarityThreshold}
            onValueChange={(v) => onChange({ ...config, similarityThreshold: v })}
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-medium">Max tokens respuesta</label>
            <span className="text-xs text-neutral-500">{config.maxTokens}</span>
          </div>
          <Slider
            min={256}
            max={8192}
            step={256}
            value={config.maxTokens}
            onValueChange={(v) => onChange({ ...config, maxTokens: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
