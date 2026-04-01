"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChunksModal } from "@/components/chat/chunks-modal";
import { TemplateSelector } from "@/components/chat/template-selector";
import { DEFAULT_TEMPLATE_ID, getTemplateById } from "@/lib/chat-templates";
import { GenerateDeliverablesDialog } from "@/components/deliverables/generate-deliverables-dialog";
import { FileText, Plus } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
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

const RAG_CONFIG = {
  topK: 50,
  similarityThreshold: 0.35,
  maxTokens: 4000,
} as const;

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [citations, setCitations] = useState<ChunkCitation[]>([]);
  const [totalChunksUsed, setTotalChunksUsed] = useState(0);
  const [showChunksModal, setShowChunksModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    };
  }, []);

  const handleAsk = useCallback(async (question: string) => {
    // Clear any existing timers
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (typeTimerRef.current) clearInterval(typeTimerRef.current);

    setIsLoading(true);
    setStreamingText("");
    setCitations([]);
    setMessages((prev) => [...prev, { role: "user", content: question }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          topK: RAG_CONFIG.topK,
          similarityThreshold: RAG_CONFIG.similarityThreshold,
          maxTokens: RAG_CONFIG.maxTokens,
          templateId: selectedTemplateId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setMessages((prev) => [...prev, { role: "assistant", content: (errorData as { error?: string }).error || "Error al procesar la pregunta." }]);
        setIsLoading(false);
        return;
      }

      const { id, chunks, totalChunksUsed: total } = await response.json() as {
        id: string;
        chunks: ChunkCitation[];
        totalChunksUsed: number;
      };
      setCitations(chunks || []);
      setTotalChunksUsed(total || 0);

      // Poll until complete
      pollTimerRef.current = setInterval(async () => {
        try {
          const poll = await fetch(`/api/chat/${id}`);
          if (!poll.ok) return;
          const data = await poll.json() as {
            id: string;
            status: string;
            answer: string;
            isDone: boolean;
          };

          if (data.status === "COMPLETE" && data.answer) {
            clearInterval(pollTimerRef.current!);
            pollTimerRef.current = null;

            // Fake streaming: reveal answer progressively
            const fullAnswer: string = data.answer;
            let charIndex = 0;
            typeTimerRef.current = setInterval(() => {
              charIndex = Math.min(charIndex + 30, fullAnswer.length);
              setStreamingText(fullAnswer.slice(0, charIndex));
              if (charIndex >= fullAnswer.length) {
                clearInterval(typeTimerRef.current!);
                typeTimerRef.current = null;
                setMessages((prev) => [...prev, { role: "assistant", content: fullAnswer }]);
                setStreamingText("");
                setIsLoading(false);
              }
            }, 30);
          } else if (data.status === "ERROR") {
            clearInterval(pollTimerRef.current!);
            pollTimerRef.current = null;
            setMessages((prev) => [...prev, { role: "assistant", content: data.answer || "Error al generar la respuesta." }]);
            setStreamingText("");
            setIsLoading(false);
          }
        } catch {
          // Network error during poll — will retry on next tick
        }
      }, 2000);

    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error de conexión." }]);
      setIsLoading(false);
    }
  }, [selectedTemplateId]);

  return (
    <PageContainer maxWidth="xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Consultar</h2>
          <p className="text-muted-foreground mt-1">
            Haz preguntas sobre tus documentos. Claude responde usando los fragmentos mas relevantes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerateDialog(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover rounded-lg transition-colors"
            title="Generar entregables desde preguntas"
          >
            <Plus className="h-4 w-4" />
            Producir
          </button>
          {citations.length > 0 && (
            <button
              onClick={() => setShowChunksModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
            >
              <FileText className="h-4 w-4" />
              Ver fragmentos ({totalChunksUsed > citations.length ? `${citations.length} de ${totalChunksUsed}` : citations.length})
            </button>
          )}
        </div>
      </div>

      <TemplateSelector
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={setSelectedTemplateId}
        disabled={isLoading}
      />

      <ChatInterface
        onAsk={handleAsk}
        messages={messages}
        isLoading={isLoading}
        streamingText={streamingText}
        templateName={getTemplateById(selectedTemplateId)?.name}
      />

      <ChunksModal
        open={showChunksModal}
        onClose={() => setShowChunksModal(false)}
        chunks={citations}
      />

      <GenerateDeliverablesDialog
        open={showGenerateDialog}
        onClose={() => setShowGenerateDialog(false)}
      />
    </PageContainer>
  );
}
