"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Copy, Download, RotateCw, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  IconButton,
  Card,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui";

interface BibData {
  citations: Array<{ author: string; year: string; title: string; publisher?: string; raw: string }>;
  formatted: string[];
  style: "apa" | "chicago";
}

export default function BibliographyPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
          <Skeleton variant="line" className="h-8 w-64 mb-4" />
          <Skeleton variant="line" className="h-4 w-full mb-2" />
          <Skeleton variant="line" className="h-4 w-3/4" />
        </div>
      }
    >
      <BibContent />
    </Suspense>
  );
}

function BibContent() {
  const params = useSearchParams();
  const deliverableId = params.get("deliverable");

  const [style, setStyle] = useState<"apa" | "chicago">("apa");
  const [data, setData] = useState<BibData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ style });
    if (deliverableId) p.set("deliverable", deliverableId);
    fetch(`/api/bibliography?${p}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [style, deliverableId]);

  useEffect(() => {
    load();
  }, [load]);

  const copyAll = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.formatted.join("\n\n"));
    toast.success(`${data.formatted.length} referencias copiadas`);
  };

  const downloadTxt = () => {
    if (!data) return;
    const blob = new Blob([data.formatted.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bibliografia-${style}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBib = () => {
    if (!data) return;
    const bib = data.citations
      .map((c, i) => {
        const key = `${(c.author.split(",")[0] || "anon").toLowerCase().replace(/[^a-z]/g, "")}${c.year}_${i}`;
        return `@book{${key},
  author = {${c.author}},
  title = {${c.title}},
  year = {${c.year}}${c.publisher ? `,\n  publisher = {${c.publisher}}` : ""}
}`;
      })
      .join("\n\n");
    const blob = new Blob([bib], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bibliografia.bib";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
      <header className="flex justify-between items-end mb-6 flex-wrap gap-3">
        <div>
          <h1
            className="serif-title text-[28px] leading-tight m-0 text-[var(--color-ink-1000)] inline-flex items-center gap-2"
            style={{ fontWeight: 700 }}
          >
            <BookOpen className="size-6 text-[var(--fg-muted)]" />
            Bibliografía
          </h1>
          <p className="text-[14px] text-[var(--fg-muted)] mt-1.5 mb-0 max-w-[720px]">
            {deliverableId
              ? "Referencias de la producción seleccionada, formateadas según el estilo elegido."
              : "Referencias bibliográficas de todo el corpus. Útil para citar en textos académicos."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={style}
            onValueChange={(v) => setStyle(v as "apa" | "chicago")}
          >
            <TabsList variant="segmented">
              <TabsTrigger variant="segmented" value="apa">
                APA 7
              </TabsTrigger>
              <TabsTrigger variant="segmented" value="chicago">
                Chicago
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <IconButton aria-label="Recargar" onClick={load}>
            <RotateCw />
          </IconButton>
        </div>
      </header>

      <Card variant="default" size="md" className="mb-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={copyAll}
            disabled={!data || data.formatted.length === 0}
          >
            <Copy className="size-4" />
            Copiar todo ({data?.formatted.length ?? 0})
          </Button>
          <Button variant="secondary" onClick={downloadTxt} disabled={!data}>
            <Download className="size-4" />
            Descargar .txt
          </Button>
          <Button variant="secondary" onClick={downloadBib} disabled={!data}>
            <Download className="size-4" />
            Descargar .bib
          </Button>
        </div>
      </Card>

      <Card variant="default" size="md">
        {loading ? (
          <div className="space-y-2">
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-11/12" />
            <Skeleton variant="line" className="h-4 w-10/12" />
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-9/12" />
            <Skeleton variant="line" className="h-4 w-11/12" />
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-10/12" />
            <Skeleton variant="line" className="h-4 w-11/12" />
            <Skeleton variant="line" className="h-4 w-9/12" />
            <Skeleton variant="line" className="h-4 w-full" />
            <Skeleton variant="line" className="h-4 w-10/12" />
          </div>
        ) : !data || data.formatted.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="size-10 text-[var(--fg-subtle)] mx-auto mb-3" />
            <div className="text-[13px] text-[var(--fg-muted)]">Sin referencias</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            {data.formatted.map((entry, i) => (
              <div
                key={i}
                style={{
                  paddingLeft: 24,
                  textIndent: -24,
                  fontFamily: "var(--font-serif)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: "var(--fg-default)",
                }}
              >
                {entry}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
