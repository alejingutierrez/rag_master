"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Send,
  FileText,
  Bot,
  Network,
  Copy,
  ChevronDown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Button,
  IconButton,
  Textarea,
  Card,
  Badge,
  Tooltip,
  Spinner,
  Kbd,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
} from "@/components/ui";
import {
  ConversationBubble,
  Citation,
  SourceCard,
} from "@/components/domain";
import { toast } from "sonner";
import {
  CHAT_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  getTemplateById,
  CATEGORY_LABELS,
} from "@/lib/chat-templates";
import { safeGet, safeSet } from "@/lib/safe-storage";

interface Message {
  role: "user" | "assistant";
  content: string;
  templateId?: string;
  citations?: ChunkCitation[];
}

interface ChunkCitation {
  id: string;
  documentId: string;
  documentFilename?: string;
  pageNumber: number;
  chunkIndex: number;
  similarity: number;
  content: string;
}

const RAG_CONFIG = { topK: 100, similarityThreshold: 0.25 };

const STARTERS = [
  "¿Cómo evolucionó el modelo bipartidista durante la Regeneración?",
  "Compara el rol de la Iglesia en el siglo XIX colombiano con su papel actual.",
  "¿Qué impacto tuvieron las reformas de López Pumarejo en la sociedad?",
  "Explica las causas estructurales de la Guerra de los Mil Días.",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [citations, setCitations] = useState<ChunkCitation[]>([]);
  const [totalChunksUsed, setTotalChunksUsed] = useState(0);
  const [selectedTemplateId, setSelectedTemplateIdState] = useState(DEFAULT_TEMPLATE_ID);
  const setSelectedTemplateId = (id: string) => {
    setSelectedTemplateIdState(id);
    safeSet("rag-master-chat-template", id);
  };
  const [showCitations, setShowCitations] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<ChunkCitation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restaurar template seleccionado
  useEffect(() => {
    const stored = safeGet<string>("rag-master-chat-template", "");
    if (stored && getTemplateById(stored)) setSelectedTemplateIdState(stored);
  }, []);

  // Auto-scroll throttled — no scrollear en cada delta del streaming
  const lastScrollRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastScrollRef.current < 120) return;
    lastScrollRef.current = now;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    };
  }, []);

  const handleAsk = useCallback(
    async (q: string) => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);

      setIsLoading(true);
      setStreamingText("");
      setCitations([]);
      setMessages((p) => [...p, { role: "user", content: q }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            topK: RAG_CONFIG.topK,
            similarityThreshold: RAG_CONFIG.similarityThreshold,
            templateId: selectedTemplateId,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMessages((p) => [
            ...p,
            { role: "assistant", content: (err as { error?: string }).error || "Error al procesar la pregunta." },
          ]);
          setIsLoading(false);
          return;
        }
        const { id, chunks, totalChunksUsed: total } = await res.json();
        setCitations(chunks || []);
        setTotalChunksUsed(total || 0);

        pollTimerRef.current = setInterval(async () => {
          try {
            const poll = await fetch(`/api/chat/${id}`);
            if (!poll.ok) return;
            const data = await poll.json();
            if (data.status === "COMPLETE" && data.answer) {
              clearInterval(pollTimerRef.current!);
              pollTimerRef.current = null;
              const full = data.answer as string;
              let i = 0;
              typeTimerRef.current = setInterval(() => {
                i = Math.min(i + 40, full.length);
                setStreamingText(full.slice(0, i));
                if (i >= full.length) {
                  clearInterval(typeTimerRef.current!);
                  typeTimerRef.current = null;
                  setMessages((p) => [
                    ...p,
                    { role: "assistant", content: full, templateId: selectedTemplateId, citations: chunks },
                  ]);
                  setStreamingText("");
                  setIsLoading(false);
                }
              }, 25);
            } else if (data.status === "ERROR") {
              clearInterval(pollTimerRef.current!);
              pollTimerRef.current = null;
              setMessages((p) => [...p, { role: "assistant", content: data.answer || "Error al generar respuesta." }]);
              setStreamingText("");
              setIsLoading(false);
            }
          } catch {
            /* will retry */
          }
        }, 2000);
      } catch (err) {
        console.error(err);
        setMessages((p) => [...p, { role: "assistant", content: "Error de conexión." }]);
        setIsLoading(false);
      }
    },
    [selectedTemplateId],
  );

  const submit = async () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput("");
    await handleAsk(q);
  };

  const template = getTemplateById(selectedTemplateId);

  // Agrupar templates por categoría para el dropdown
  const templatesByCategory = Object.entries(
    CHAT_TEMPLATES.reduce<Record<string, typeof CHAT_TEMPLATES>>((acc, t) => {
      (acc[t.category] = acc[t.category] || []).push(t);
      return acc;
    }, {}),
  );

  const sourcesLabel =
    totalChunksUsed > citations.length
      ? `${citations.length}/${totalChunksUsed}`
      : `${citations.length}`;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--bg-page)] px-7 py-4">
          <div className="flex items-center gap-3.5">
            <MessageCircle className="size-5 text-[var(--accent)]" />
            <div>
              <div className="serif-title text-[16px] font-semibold text-[var(--color-ink-1000)]">
                Consultar el corpus
              </div>
              <div className="text-[11px] text-[var(--fg-subtle)]">
                RAG híbrido con citas · Claude Opus 4.7
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={isLoading}
                  trailingIcon={<ChevronDown className="size-3.5" />}
                  className="min-w-[240px] justify-between"
                >
                  <span className="truncate">
                    {template?.icon ? `${template.icon} ` : ""}
                    {template?.name ?? "Formato"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[280px] max-h-[480px] overflow-y-auto">
                <DropdownMenuRadioGroup
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  {templatesByCategory.map(([cat, templates], idx) => (
                    <div key={cat}>
                      {idx > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel>
                        {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                      </DropdownMenuLabel>
                      {templates.map((t) => (
                        <DropdownMenuRadioItem key={t.id} value={t.id}>
                          <span className="mr-1">{t.icon}</span>
                          <span>{t.name}</span>
                        </DropdownMenuRadioItem>
                      ))}
                    </div>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip content="Ver citas de la última respuesta">
              <Button
                variant="secondary"
                size="md"
                leadingIcon={<FileText className="size-4" />}
                onClick={() => setShowCitations(true)}
                disabled={citations.length === 0}
              >
                Fuentes ({sourcesLabel})
              </Button>
            </Tooltip>

            <Link href="/compare">
              <Button
                variant="secondary"
                size="md"
                leadingIcon={<Network className="size-4" />}
              >
                Comparar
              </Button>
            </Link>
          </div>
        </div>

        {/* Conversation area */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          <div className="mx-auto max-w-[880px]">
            {messages.length === 0 && !isLoading && (
              <EmptyState onPick={(q) => setInput(q)} template={template?.name} />
            )}

            {messages.map((m, i) => (
              <MessageItem
                key={i}
                message={m}
                onCiteClick={(idx) => {
                  if (m.citations && m.citations[idx - 1]) setSelectedCitation(m.citations[idx - 1]);
                }}
              />
            ))}

            {isLoading && streamingText && (
              <MessageItem
                message={{ role: "assistant", content: streamingText, citations }}
                streaming
                onCiteClick={(idx) => citations[idx - 1] && setSelectedCitation(citations[idx - 1])}
              />
            )}

            {isLoading && !streamingText && (
              <div className="my-5 flex items-center gap-3">
                <Avatar size="sm" className="bg-[var(--accent-bg-subtle)] text-[var(--accent)]">
                  <AvatarFallback>
                    <Bot className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-page)] px-3.5 py-2.5">
                  <Spinner size={14} className="text-[var(--accent)]" />
                  <span className="text-sm text-[var(--fg-muted)]">
                    Buscando en el corpus y razonando…
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-[var(--border-default)] bg-[var(--bg-page)] px-7 py-4">
          <div className="mx-auto max-w-[880px]">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Pregunta usando "${template?.name}"… Mínimo 4 palabras significativas.`}
                rows={2}
                disabled={isLoading}
                className="min-h-[64px] max-h-[180px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <Button
                aria-label="Enviar pregunta"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                disabled={!input.trim()}
                onClick={submit}
                className="h-[64px] w-12 px-0"
              >
                {!isLoading && <Send className="size-4" />}
              </Button>
            </div>
            <div className="mt-1.5 text-[11px] text-[var(--fg-subtle)]">
              <Kbd>⏎</Kbd> enviar · <Kbd>⇧⏎</Kbd> nueva línea · La respuesta puede tardar 30-90s con thinking extendido.
            </div>
          </div>
        </div>
      </div>

      {/* Drawer: fuentes citadas */}
      <Drawer open={showCitations} onOpenChange={setShowCitations}>
        <DrawerContent side="right" size="lg">
          <DrawerHeader>
            <DrawerTitle>Fuentes citadas</DrawerTitle>
            <DrawerDescription>
              {citations.length === 0
                ? "Sin citas en la última respuesta."
                : `${citations.length} fuentes${
                    totalChunksUsed > citations.length ? ` de ${totalChunksUsed} totales` : ""
                  }.`}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            {citations.length === 0 ? (
              <div className="py-12 text-center text-sm text-[var(--fg-subtle)]">
                Sin citas
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {citations.map((c, i) => (
                  <CitationListItem
                    key={c.id}
                    idx={i + 1}
                    citation={c}
                    onExpand={() => setSelectedCitation(c)}
                  />
                ))}
              </div>
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Drawer: cita individual */}
      <Drawer
        open={!!selectedCitation}
        onOpenChange={(open) => !open && setSelectedCitation(null)}
      >
        <DrawerContent side="right" size="lg">
          {selectedCitation && (
            <>
              <DrawerHeader>
                <DrawerTitle>
                  Cita #{citations.indexOf(selectedCitation) + 1}
                </DrawerTitle>
                <DrawerDescription>
                  {selectedCitation.documentFilename} · p. {selectedCitation.pageNumber}
                </DrawerDescription>
              </DrawerHeader>
              <DrawerBody>
                <SourceCard
                  type="archive"
                  title={selectedCitation.documentFilename || "Documento sin título"}
                  snippet={selectedCitation.content}
                />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="subtle" size="sm">
                    chunk #{selectedCitation.chunkIndex}
                  </Badge>
                  <Badge variant="tinta" size="sm">
                    sim {(selectedCitation.similarity * 100).toFixed(1)}%
                  </Badge>
                  <Link href={`/documents/${selectedCitation.documentId}`}>
                    <Button
                      variant="secondary"
                      size="sm"
                      leadingIcon={<FileText className="size-3.5" />}
                    >
                      Abrir documento
                    </Button>
                  </Link>
                </div>
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/* ─── Sub-componentes ────────────────────────────────────────────────────── */

function EmptyState({
  onPick,
  template,
}: {
  onPick: (q: string) => void;
  template?: string;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div
        className="mx-auto mb-5 inline-flex size-16 items-center justify-center rounded-2xl text-[var(--accent)]"
        style={{ background: "var(--accent-bg-subtle)" }}
      >
        <MessageCircle className="size-7" />
      </div>
      <h2
        className="serif-title text-[28px] font-semibold leading-tight text-[var(--color-ink-1000)]"
      >
        ¿Qué quieres investigar?
      </h2>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        Formato actual:{" "}
        <span className="font-semibold text-[var(--fg-default)]">{template}</span>.
        Respuestas con citas trazables al corpus.
      </p>

      <div className="mx-auto mt-6 grid max-w-[640px] gap-2.5 sm:grid-cols-2">
        {STARTERS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-page)] p-3.5 text-left text-[13px] text-[var(--fg-default)] transition-colors duration-[var(--duration-instant)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)]"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageItem({
  message,
  streaming,
  onCiteClick,
}: {
  message: Message;
  streaming?: boolean;
  onCiteClick?: (idx: number) => void;
}) {
  const isUser = message.role === "user";
  const tpl = message.templateId ? getTemplateById(message.templateId) : undefined;

  if (isUser) {
    return (
      <ConversationBubble from="user">
        <div className="whitespace-pre-wrap">{message.content}</div>
      </ConversationBubble>
    );
  }

  return (
    <ConversationBubble from="assistant" streaming={streaming}>
      <AssistantContent content={message.content} citations={message.citations} onCiteClick={onCiteClick} />
      {!streaming && message.content && (
        <div className="not-prose mt-3 flex items-center gap-2 text-[11px] text-[var(--fg-subtle)]">
          {tpl && (
            <Badge variant="subtle" size="xs">
              {tpl.icon} {tpl.name}
            </Badge>
          )}
          <Tooltip content="Copiar respuesta">
            <IconButton
              aria-label="Copiar"
              variant="ghost"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(message.content);
                toast.success("Respuesta copiada");
              }}
            >
              <Copy className="size-3.5" />
            </IconButton>
          </Tooltip>
        </div>
      )}
    </ConversationBubble>
  );
}

/**
 * Renderiza markdown con citas [#N] reemplazadas por <Citation/> inline.
 */
function AssistantContent({
  content,
  citations,
  onCiteClick,
}: {
  content: string;
  citations?: ChunkCitation[];
  onCiteClick?: (idx: number) => void;
}) {
  // Sustituimos [#N] por `#N` para que Markdown lo emita como <code>, y luego
  // detectamos esos códigos para reemplazarlos por <Citation/>.
  const enhanced = content.replace(/\[#(\d+)\]/g, (_match, n) => `\`#${n}\``);

  return (
    <ReactMarkdown
      components={{
        code({ children, ...props }) {
          const txt = String(children).replace(/`/g, "");
          const m = /^#(\d+)$/.exec(txt);
          if (m) {
            const idx = Number(m[1]);
            const cite = citations?.[idx - 1];
            return (
              <Citation
                number={idx}
                sourceTitle={cite?.documentFilename}
                snippet={cite?.content}
                meta={
                  cite
                    ? `p. ${cite.pageNumber} · sim ${(cite.similarity * 100).toFixed(0)}%`
                    : undefined
                }
                onOpenSource={() => onCiteClick?.(idx)}
              />
            );
          }
          return <code {...props}>{children}</code>;
        },
      }}
    >
      {enhanced}
    </ReactMarkdown>
  );
}

function CitationListItem({
  idx,
  citation,
  onExpand,
}: {
  idx: number;
  citation: ChunkCitation;
  onExpand: () => void;
}) {
  return (
    <Card
      variant="default"
      size="sm"
      interactive
      onClick={onExpand}
      className="p-3"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="tinta" size="xs" className="font-mono">
            #{idx}
          </Badge>
          <span className="text-[11px] text-[var(--fg-subtle)]">
            p. {citation.pageNumber} · sim {(citation.similarity * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="mb-1.5 truncate text-[12.5px] font-medium text-[var(--fg-default)]">
        {citation.documentFilename}
      </div>
      <p
        className="line-clamp-3 text-[13px] leading-relaxed text-[var(--fg-muted)]"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {citation.content}
      </p>
    </Card>
  );
}
