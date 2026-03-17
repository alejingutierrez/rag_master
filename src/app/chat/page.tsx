"use client";

import { useState, useCallback } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";
import { ChunkCitations } from "@/components/chat/chunk-citations";
import {
  SearchConfigPanel,
  type SearchConfig,
} from "@/components/chat/search-config";

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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [citations, setCitations] = useState<ChunkCitation[]>([]);
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    topK: 5,
    similarityThreshold: 0.7,
    maxTokens: 4096,
  });

  const handleAsk = useCallback(
    async (question: string) => {
      setIsLoading(true);
      setStreamingText("");
      setCitations([]);

      // Agregar mensaje del usuario
      setMessages((prev) => [...prev, { role: "user", content: question }]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            topK: searchConfig.topK,
            similarityThreshold: searchConfig.similarityThreshold,
            maxTokens: searchConfig.maxTokens,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: errorData.error || "Error al procesar la pregunta.",
            },
          ]);
          setIsLoading(false);
          return;
        }

        // Extraer chunks usados del header
        const chunksHeader = response.headers.get("X-Chunks-Used");
        if (chunksHeader) {
          try {
            const chunks = JSON.parse(chunksHeader);
            setCitations(chunks);
          } catch {
            // Header parsing failed, continue without citations
          }
        }

        // Leer stream SSE
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
                if (data.text) {
                  fullText += data.text;
                  setStreamingText(fullText);
                }
                if (data.done) {
                  // Stream completado
                }
              } catch {
                // Ignorar líneas inválidas
              }
            }
          }
        }

        // Agregar respuesta completa como mensaje
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
    },
    [searchConfig]
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900">Preguntas</h2>
        <p className="text-neutral-500 mt-1">
          Haz preguntas sobre tus documentos. Claude responde usando los fragmentos mas relevantes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Panel lateral: configuración y citas */}
        <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
          <SearchConfigPanel
            config={searchConfig}
            onChange={setSearchConfig}
          />
          <ChunkCitations chunks={citations} />
        </div>

        {/* Chat principal */}
        <div className="lg:col-span-3 order-1 lg:order-2">
          <ChatInterface
            onAsk={handleAsk}
            messages={messages}
            isLoading={isLoading}
            streamingText={streamingText}
          />
        </div>
      </div>
    </div>
  );
}
