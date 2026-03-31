"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Edit3, X } from "lucide-react";

interface Chunk {
  id: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

interface ChunkEditorProps {
  chunks: Chunk[];
  onSaveChunk: (chunkId: string, content: string) => Promise<void>;
}

export function ChunkEditor({ chunks, onSaveChunk }: ChunkEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (chunk: Chunk) => {
    setEditingId(chunk.id);
    setEditContent(chunk.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSave = async (chunkId: string) => {
    setSaving(true);
    try {
      await onSaveChunk(chunkId, editContent);
      setEditingId(null);
      setEditContent("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">
        Editar Chunks ({chunks.length})
      </h3>
      <p className="text-sm text-muted-foreground">
        Al editar un chunk se regenera automaticamente su embedding.
      </p>

      {chunks.map((chunk) => (
        <div key={chunk.id} className="border border-border rounded-lg p-4 bg-surface">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">#{chunk.chunkIndex}</Badge>
            <Badge variant="outline">Pag. {chunk.pageNumber}</Badge>
            <div className="ml-auto">
              {editingId === chunk.id ? (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelEdit}
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSave(chunk.id)}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(chunk)}
                >
                  <Edit3 className="h-4 w-4" />
                  Editar
                </Button>
              )}
            </div>
          </div>

          {editingId === chunk.id ? (
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
          ) : (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-4">
              {chunk.content}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
