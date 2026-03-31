"use client";

import { useState, useCallback } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChunksModal } from "@/components/chat/chunks-modal";
import { FileText } from "lucide-react";

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
  topK: 30,
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

  const handleAsk = useCallback(async (question: string) => {
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
        }),
      });

      if (!response.ok) {
        let errorMsg = "Error al procesar la pregunta.";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          if (response.status === 504) errorMsg = "La consulta tardo demasiado. Intenta con una pregunta mas corta.";
          else if (response.status === 500) errorMsg = "Error interno del servidor. Verifica que Bedrock este disponible.";
        }
        setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
        setIsLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let sseBuffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunks) {
                setCitations(data.chunks);
                setTotalChunksUsed(data.totalChunksUsed || data.chunks.length);
              }
              if (data.text) {
                fullText += data.text;
                setStreamingText(fullText);
              }
            } catch { /* ignore */ }
          }
        }

        if (sseBuffer.startsWith("data: ")) {
          try {
            const data = JSON.parse(sseBuffer.slice(6));
            if (data.text) fullText += data.text;
          } catch { /* ignore */ }
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: fullText }]);
      setStreamingText("");
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error de conexion. Verifica que el servidor este funcionando." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <PageContainer maxWidth="xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Consultar</h2>
          <p className="text-muted-foreground mt-1">
            Haz preguntas sobre tus documentos. Claude responde usando los fragmentos mas relevantes.
          </p>
        </div>
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

      <ChatInterface
        onAsk={handleAsk}
        messages={messages}
        isLoading={isLoading}
        streamingText={streamingText}
      />

      <ChunksModal
        open={showChunksModal}
        onClose={() => setShowChunksModal(false)}
        chunks={citations}
      />
    </PageContainer>
  );
}
