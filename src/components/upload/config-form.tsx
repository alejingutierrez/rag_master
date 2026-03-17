"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Select } from "@/components/ui/select";

export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
  strategy: string;
}

interface ConfigFormProps {
  config: ChunkConfig;
  onChange: (config: ChunkConfig) => void;
}

export function ConfigForm({ config, onChange }: ConfigFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuracion de Chunking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">Tamano de chunk</label>
            <span className="text-sm text-neutral-500">{config.chunkSize} caracteres</span>
          </div>
          <Slider
            min={256}
            max={4096}
            step={128}
            value={config.chunkSize}
            onValueChange={(v) => onChange({ ...config, chunkSize: v })}
          />
          <div className="flex justify-between text-xs text-neutral-400 mt-1">
            <span>256</span>
            <span>4096</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium">Solapamiento (overlap)</label>
            <span className="text-sm text-neutral-500">{config.chunkOverlap} caracteres</span>
          </div>
          <Slider
            min={0}
            max={512}
            step={32}
            value={config.chunkOverlap}
            onValueChange={(v) => onChange({ ...config, chunkOverlap: v })}
          />
          <div className="flex justify-between text-xs text-neutral-400 mt-1">
            <span>0</span>
            <span>512</span>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Estrategia de chunking</label>
          <Select
            value={config.strategy}
            onChange={(e) => onChange({ ...config, strategy: e.target.value })}
          >
            <option value="FIXED">Tamano fijo con overlap</option>
            <option value="PARAGRAPH">Por parrafos</option>
            <option value="SENTENCE">Por oraciones</option>
          </Select>
          <p className="text-xs text-neutral-400 mt-2">
            {config.strategy === "FIXED" &&
              "Divide el texto en bloques de tamano fijo con solapamiento configurable."}
            {config.strategy === "PARAGRAPH" &&
              "Divide por parrafos naturales, fusionando los pequenos y dividiendo los grandes."}
            {config.strategy === "SENTENCE" &&
              "Divide por oraciones y las agrupa hasta alcanzar el tamano objetivo."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
