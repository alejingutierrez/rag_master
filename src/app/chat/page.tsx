"use client";

import { useState, useCallback } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChunksModal } from "@/components/chat/chunks-modal";

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

// Valores fijos de configuración RAG
// topK=30 para máximo contexto, maxTokens=800 para caber en timeout 30s de Amplify
const RAG_CONFIG = {
  topK: 30,
  similarityThreshold: 0.35,
  maxTokens: 800,
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
          // Lambda timeout o respuesta vacía — el body no es JSON válido
          if (response.status === 504) {
            errorMsg = "La consulta tardó demasiado. Intenta con una pregunta más corta.";
          } else if (response.status === 500) {
            errorMsg = "Error interno del servidor. Verifica que Bedrock esté disponible.";
          }
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: errorMsg },
        ]);
        setIsLoading(false);
        return;
      }

      // Leer stream SSE (chunks vienen como primer evento, luego texto)
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            try {
              const data = JSON.parse(line.replace("data: ", ""));
              // Primer evento: metadatos de chunks
              if (data.chunks) {
                setCitations(data.chunks);
                setTotalChunksUsed(data.totalChunksUsed || data.chunks.length);
              }
              // Eventos de texto de Claude
              if (data.text) {
                fullText += data.text;
                setStreamingText(fullText);
              }
            } catch {
              // Ignorar líneas inválidas
            }
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: fullText },
      ]);
      setStreamingText("");
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error de conexion. Verifica que el servidor este funcionando.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Preguntas</h2>
          <p className="text-neutral-500 mt-1">
            Haz preguntas sobre tus documentos. Claude responde usando los fragmentos mas relevantes.
          </p>
        </div>
        {citations.length > 0 && (
          <button
            onClick={() => setShowChunksModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
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
    </div>
  );
}
