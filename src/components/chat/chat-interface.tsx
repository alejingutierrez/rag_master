"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, User, Bot, MessageSquare } from "lucide-react";
import { MarkdownRenderer } from "./markdown-renderer";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatInterfaceProps {
  onAsk: (question: string) => Promise<void>;
  messages: Message[];
  isLoading: boolean;
  streamingText: string;
  templateName?: string;
}

export function ChatInterface({
  onAsk,
  messages,
  isLoading,
  streamingText,
  templateName,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;
    setInput("");
    await onAsk(question);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Mensajes */}
      <div className="flex-1 overflow-auto space-y-4 pb-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">Haz una pregunta sobre tus documentos</p>
            <p className="text-sm text-muted-foreground mt-1">
              {templateName
                ? `Formato: ${templateName} — Las respuestas se basan en los fragmentos mas relevantes de tus PDFs.`
                : "Las respuestas se basan en los fragmentos mas relevantes de tus PDFs."}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-accent" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-chat-user text-chat-user-foreground"
                  : "bg-chat-assistant border border-border text-chat-assistant-foreground"
              }`}
            >
              {msg.role === "assistant" ? (
                <MarkdownRenderer content={msg.content} />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming response */}
        {isLoading && streamingText && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-accent" />
            </div>
            <div className="max-w-[80%] rounded-xl px-4 py-3 bg-chat-assistant border border-border">
              <MarkdownRenderer content={streamingText} />
              <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {isLoading && !streamingText && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-accent" />
            </div>
            <div className="rounded-xl px-4 py-3 bg-chat-assistant border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t border-border">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta aqui..."
          rows={2}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="h-auto"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
