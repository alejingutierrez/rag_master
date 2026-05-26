"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Download,
  Copy,
  CheckCircle2,
  FileText,
  RotateCw,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import dayjs from "@/lib/dayjs-config";
import ReactMarkdown from "react-markdown";
import {
  Button,
  Card,
  Skeleton,
  Spinner,
  Badge,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  Popover,
  PopoverTrigger,
  PopoverContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Separator,
} from "@/components/ui";
import { ResearchHeader } from "@/components/domain/research-header";
import { ProseBlock } from "@/components/domain/prose-block";
import { getTemplateById } from "@/lib/chat-templates";

interface DeliverableDetail {
  id: string;
  templateId: string;
  answer: string;
  modelUsed: string;
  status: string;
  source: string;
  userQuestion: string | null;
  createdAt: string;
  updatedAt: string;
  chunksUsed: Array<{
    documentFilename?: string;
    pageNumber?: number;
    similarity?: number;
    content?: string;
  }>;
  question: null | {
    id?: string;
    pregunta: string;
    periodoCode: string;
    periodoNombre: string;
    categoriaCode: string;
    categoriaNombre: string;
    document?: { id?: string; filename: string };
  };
}

export default function ProduccionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DeliverableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`/api/deliverables/${id}`);
      if (!r.ok) {
        setError("Producción no encontrada");
        return;
      }
      const d = await r.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (data?.status !== "GENERATING") return;
    const t = setInterval(fetchData, 3000);
    return () => clearInterval(t);
  }, [data?.status, fetchData]);

  const wordCount = useMemo(() => {
    if (!data?.answer) return 0;
    return data.answer.trim().split(/\s+/).filter(Boolean).length;
  }, [data?.answer]);

  const handleCopy = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.answer);
    setCopied(true);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (format: "md" | "docx" | "pdf") => {
    if (!data) return;
    setDownloading(format);
    try {
      const res = await fetch(`/api/deliverables/${id}/export?format=${format}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = (data.question?.pregunta ?? "produccion")
        .slice(0, 50)
        .replace(/[^\w\s]/g, "");
      a.download = `${name}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Descargado .${format}`);
    } catch {
      toast.error("Error al exportar");
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="app-page">
        <Skeleton variant="line" className="h-8 w-48 mb-4" />
        <Skeleton variant="line" className="h-12 w-full mb-3" />
        <Skeleton variant="line" className="h-4 w-3/4 mb-6" />
        <Skeleton variant="line" className="h-4 w-full mb-2" />
        <Skeleton variant="line" className="h-4 w-full mb-2" />
        <Skeleton variant="line" className="h-4 w-11/12 mb-2" />
        <Skeleton variant="line" className="h-4 w-10/12" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="app-page">
        <Card variant="default" size="lg">
          <div className="py-10 flex flex-col items-center text-center gap-3">
            <div
              aria-hidden
              className="size-16 rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-muted)] flex items-center justify-center text-[var(--fg-subtle)]"
            >
              <FileText className="size-7" />
            </div>
            <div className="text-[14px] text-[var(--fg-muted)]">
              {error || "Sin datos"}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const tpl = getTemplateById(data.templateId);
  const title = data.question?.pregunta ?? data.userQuestion ?? "(producción libre)";
  const subtitle = tpl?.name
    ? `${tpl.icon ?? ""} ${tpl.name}`.trim()
    : data.templateId;

  const headerMeta: Array<{ label: string; value: React.ReactNode }> = [];
  if (wordCount > 0) {
    headerMeta.push({
      label: "palabras",
      value: wordCount.toLocaleString("es-CO"),
    });
  }
  headerMeta.push({
    label: "fuentes",
    value: String(data.chunksUsed?.length ?? 0),
  });
  headerMeta.push({
    label: "actualizado",
    value: dayjs(data.updatedAt).format("DD MMM YYYY HH:mm"),
  });
  headerMeta.push({
    label: "modelo",
    value: (
      <span className="font-mono text-[11px]">
        {data.modelUsed.replace("us.anthropic.", "")}
      </span>
    ),
  });

  return (
    <div className="app-page">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="mb-4 -ml-2"
      >
        <ArrowLeft className="size-4" />
        Volver
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="min-w-0">
          <ResearchHeader
            title={title}
            subtitle={subtitle}
            periodCode={data.question?.periodoCode}
            categoryCodes={
              data.question?.categoriaCode ? [data.question.categoriaCode] : undefined
            }
            meta={headerMeta}
            breadcrumb={
              <span className="flex items-center gap-1.5">
                <Link href="/producciones" className="hover:underline">
                  Producciones
                </Link>
                <span aria-hidden>›</span>
                <span className="text-[var(--fg-muted)]">Detalle</span>
                {data.status === "GENERATING" && (
                  <Badge variant="info" size="xs" className="ml-2">
                    <Spinner size={10} />
                    Generando
                  </Badge>
                )}
              </span>
            }
            className="mb-6 max-w-none"
          />

          {data.status === "GENERATING" && !data.answer ? (
            <Card variant="default" size="lg">
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <Spinner size={28} />
                <p className="text-[14px] text-[var(--fg-muted)] m-0">
                  Generando contenido…
                </p>
              </div>
            </Card>
          ) : (
            <ProseBlock width="reading" className="max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ children, ...props }) {
                    const txt = String(children).replace(/`/g, "");
                    const m = /^#(\d+)$/.exec(txt);
                    if (m) {
                      const idx = parseInt(m[1], 10) - 1;
                      const chunk = data.chunksUsed?.[idx];
                      if (!chunk) {
                        return (
                          <span
                            className="citation"
                            onClick={() => setShowSources(true)}
                            style={{ cursor: "pointer" }}
                          >
                            #{m[1]}
                          </span>
                        );
                      }
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <span
                              className="citation"
                              onClick={() => setShowSources(true)}
                              style={{ cursor: "help" }}
                            >
                              #{m[1]}
                            </span>
                          </PopoverTrigger>
                          <PopoverContent
                            align="center"
                            className="max-w-[360px]"
                          >
                            <div className="text-xs font-semibold text-[var(--fg-default)] mb-1">
                              {chunk.documentFilename ?? "Documento sin nombre"}
                            </div>
                            <div className="text-[11px] text-[var(--fg-muted)]">
                              p. {chunk.pageNumber}
                              {chunk.similarity !== undefined &&
                                ` · sim ${(chunk.similarity * 100).toFixed(0)}%`}
                            </div>
                            {chunk.content && (
                              <>
                                <Separator className="my-2" />
                                <p
                                  className="text-[12.5px] leading-snug m-0 text-[var(--fg-muted)]"
                                  style={{ fontFamily: "var(--font-serif)" }}
                                >
                                  {chunk.content}
                                </p>
                              </>
                            )}
                          </PopoverContent>
                        </Popover>
                      );
                    }
                    return <code {...props}>{children}</code>;
                  },
                }}
              >
                {data.answer.replace(/\[#(\d+(?:\s*,\s*\d+)*)\]/g, (_match, nums) =>
                  String(nums)
                    .split(",")
                    .map((n) => `\`#${n.trim()}\``)
                    .join(" "),
                )}
              </ReactMarkdown>
            </ProseBlock>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Card variant="default" size="sm">
            <h3 className="text-[13px] font-semibold text-[var(--fg-default)] mb-3">
              Acciones
            </h3>
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                fullWidth
                onClick={handleCopy}
                disabled={!data.answer}
              >
                {copied ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied ? "Copiado" : "Copiar Markdown"}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    fullWidth
                    isLoading={!!downloading}
                    disabled={!data.answer}
                  >
                    <Download className="size-4" />
                    Exportar como…
                    <ChevronDown className="size-3.5 ml-auto" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  <DropdownMenuItem onSelect={() => handleDownload("md")}>
                    .md
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleDownload("docx")}>
                    .docx
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleDownload("pdf")}>
                    .pdf
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="secondary"
                fullWidth
                onClick={() => setShowSources(true)}
                disabled={(data.chunksUsed?.length ?? 0) === 0}
              >
                <FileText className="size-4" />
                Ver fuentes ({data.chunksUsed?.length ?? 0})
              </Button>

              <Button variant="secondary" fullWidth asChild>
                <Link href={`/bibliography?deliverable=${data.id}`}>
                  <BookOpen className="size-4" />
                  Generar bibliografía
                </Link>
              </Button>
            </div>
          </Card>

          <Card variant="default" size="sm">
            <h3 className="text-[13px] font-semibold text-[var(--fg-default)] mb-3">
              Contexto
            </h3>
            <div className="flex flex-col gap-3">
              {data.question?.document && (
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
                    Documento fuente
                  </div>
                  <div className="mt-1 text-[13px]">
                    {data.question.document.id ? (
                      <Link
                        href={`/documents/${data.question.document.id}`}
                        className="text-[var(--accent)] hover:underline"
                      >
                        {data.question.document.filename}
                      </Link>
                    ) : (
                      <span>{data.question.document.filename}</span>
                    )}
                  </div>
                </div>
              )}
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
                  Origen
                </div>
                <div className="mt-1.5">
                  <Badge
                    variant={
                      data.source === "chat"
                        ? "info"
                        : data.source === "deep_research"
                          ? "warning"
                          : "tinta"
                    }
                    size="xs"
                  >
                    {data.source}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
                  Modelo
                </div>
                <div className="mt-1 text-[11px] font-mono text-[var(--fg-default)]">
                  {data.modelUsed.replace("us.anthropic.", "")}
                </div>
              </div>
              {data.status === "GENERATING" && (
                <div className="flex items-center gap-2 text-[12px] text-[var(--color-info-fg)]">
                  <RotateCw className="size-3.5 animate-spin" />
                  Actualizando…
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>

      <Drawer open={showSources} onOpenChange={setShowSources}>
        <DrawerContent side="right" size="lg">
          <DrawerHeader>
            <DrawerTitle>
              Fuentes citadas ({data.chunksUsed?.length ?? 0})
            </DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="flex flex-col gap-2.5">
              {(data.chunksUsed ?? []).map((c, i) => (
                <Card key={i} variant="default" size="sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" size="xs" className="font-mono">
                        #{i + 1}
                      </Badge>
                      <span className="text-[11px] text-[var(--fg-muted)]">
                        p. {c.pageNumber}
                        {c.similarity !== undefined &&
                          ` · sim ${(c.similarity * 100).toFixed(0)}%`}
                      </span>
                    </div>
                  </div>
                  <div className="text-[12px] font-semibold text-[var(--fg-default)] mb-1.5">
                    {c.documentFilename}
                  </div>
                  {c.content && (
                    <p
                      className="text-[13px] leading-relaxed text-[var(--fg-muted)] m-0 line-clamp-6"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {c.content}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
