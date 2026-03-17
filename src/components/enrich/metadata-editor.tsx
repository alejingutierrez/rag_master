"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, X, Plus } from "lucide-react";

interface MetadataEditorProps {
  documentId: string;
  metadata: Record<string, unknown>;
  onSave: (metadata: Record<string, unknown>) => Promise<void>;
}

export function MetadataEditor({ documentId, metadata, onSave }: MetadataEditorProps) {
  const [description, setDescription] = useState(
    (metadata.description as string) || ""
  );
  const [category, setCategory] = useState(
    (metadata.category as string) || ""
  );
  const [tags, setTags] = useState<string[]>(
    (metadata.tags as string[]) || []
  );
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        description,
        category,
        tags,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata del Documento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-1">Descripcion</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripcion del contenido del documento..."
            rows={3}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Categoria</label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="ej: legal, tecnico, financiero..."
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Etiquetas</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => handleRemoveTag(tag)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nueva etiqueta..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
            />
            <Button variant="outline" size="sm" onClick={handleAddTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4" />
          {saving ? "Guardando..." : "Guardar Metadata"}
        </Button>
      </CardContent>
    </Card>
  );
}
