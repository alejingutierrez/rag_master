"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, X, Plus, Sparkles, MessageSquare, ExternalLink } from "lucide-react";
import { PERIOD_OPTIONS, CATEGORY_OPTIONS } from "@/lib/taxonomy";
import type { EnrichmentMetadata } from "@/lib/enrichment-types";
import { toast } from "sonner";
import Link from "next/link";

interface EnrichmentFormProps {
  documentId: string;
  filename: string;
  metadata: Record<string, unknown>;
  onSave: (metadata: Record<string, unknown>) => Promise<void>;
  onEnrichWithAI: () => Promise<void>;
}

export function EnrichmentForm({
  documentId,
  filename,
  metadata,
  onSave,
  onEnrichWithAI,
}: EnrichmentFormProps) {
  const meta = metadata as EnrichmentMetadata;

  const [bookTitle, setBookTitle] = useState(meta.bookTitle || "");
  const [author, setAuthor] = useState(meta.author || "");
  const [isbn, setIsbn] = useState(meta.isbn || "");
  const [pageCount, setPageCount] = useState(meta.pageCount?.toString() || "");
  const [publisher, setPublisher] = useState(meta.publisher || "");
  const [publicationYear, setPublicationYear] = useState(meta.publicationYear?.toString() || "");
  const [edition, setEdition] = useState(meta.edition || "");
  const [summary, setSummary] = useState(meta.summary || "");
  const [primaryPeriod, setPrimaryPeriod] = useState(meta.primaryPeriod || "");
  const [secondaryPeriod, setSecondaryPeriod] = useState(meta.secondaryPeriod || "");
  const [primaryCategory, setPrimaryCategory] = useState(meta.primaryCategory || "");
  const [secondaryCategory, setSecondaryCategory] = useState(meta.secondaryCategory || "");
  const [keywords, setKeywords] = useState<string[]>(meta.keywords || []);
  const [newKeyword, setNewKeyword] = useState("");

  const [saving, setSaving] = useState(false);
  const [enrichingAI, setEnrichingAI] = useState(false);
  const [questionCount, setQuestionCount] = useState<number | null>(null);

  // Fetch question count
  useEffect(() => {
    fetch(`/api/documents/${documentId}/questions`)
      .then((res) => res.json())
      .then((data) => setQuestionCount(data.count ?? 0))
      .catch(() => setQuestionCount(0));
  }, [documentId]);

  const handleAddKeyword = () => {
    const kw = newKeyword.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        bookTitle: bookTitle || undefined,
        author: author || undefined,
        isbn: isbn || undefined,
        pageCount: pageCount ? parseInt(pageCount) : undefined,
        publisher: publisher || undefined,
        publicationYear: publicationYear ? parseInt(publicationYear) : undefined,
        edition: edition || undefined,
        summary: summary || undefined,
        primaryPeriod: primaryPeriod || undefined,
        secondaryPeriod: secondaryPeriod || undefined,
        primaryCategory: primaryCategory || undefined,
        secondaryCategory: secondaryCategory || undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEnrichAI = async () => {
    setEnrichingAI(true);
    try {
      await onEnrichWithAI();
      toast.success("Documento enriquecido con IA");
    } catch {
      toast.error("Error al enriquecer con IA");
    } finally {
      setEnrichingAI(false);
    }
  };

  // Sync form when metadata changes externally (after AI enrichment)
  useEffect(() => {
    const m = metadata as EnrichmentMetadata;
    setBookTitle(m.bookTitle || "");
    setAuthor(m.author || "");
    setIsbn(m.isbn || "");
    setPageCount(m.pageCount?.toString() || "");
    setPublisher(m.publisher || "");
    setPublicationYear(m.publicationYear?.toString() || "");
    setEdition(m.edition || "");
    setSummary(m.summary || "");
    setPrimaryPeriod(m.primaryPeriod || "");
    setSecondaryPeriod(m.secondaryPeriod || "");
    setPrimaryCategory(m.primaryCategory || "");
    setSecondaryCategory(m.secondaryCategory || "");
    setKeywords(m.keywords || []);
  }, [metadata]);

  const selectClass = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-ring";

  return (
    <div className="space-y-6">
      {/* AI Enrich button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleEnrichAI}
          disabled={enrichingAI}
          variant="outline"
          className="gap-2"
        >
          {enrichingAI ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Enriqueciendo con IA...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Enriquecer con IA</>
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          Archivo: <span className="font-mono">{filename}</span>
        </span>
      </div>

      {/* Bibliographic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información Bibliográfica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Título del libro</label>
              <Input
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="Título completo del libro"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Autor(es)</label>
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Nombre del autor"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">ISBN</label>
              <Input
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="ISBN"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Páginas</label>
              <Input
                type="number"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
                placeholder="Número de páginas"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Editorial</label>
              <Input
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="Editorial"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Año de publicación</label>
              <Input
                type="number"
                value={publicationYear}
                onChange={(e) => setPublicationYear(e.target.value)}
                placeholder="Año"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Edición</label>
              <Input
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
                placeholder="ej: Primera edición"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Classification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clasificación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">Período principal</label>
              <select value={primaryPeriod} onChange={(e) => setPrimaryPeriod(e.target.value)} className={selectClass}>
                <option value="">— Sin asignar —</option>
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p.code} value={p.code}>{p.code} — {p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Período secundario</label>
              <select value={secondaryPeriod} onChange={(e) => setSecondaryPeriod(e.target.value)} className={selectClass}>
                <option value="">— Sin asignar —</option>
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p.code} value={p.code}>{p.code} — {p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Categoría principal</label>
              <select value={primaryCategory} onChange={(e) => setPrimaryCategory(e.target.value)} className={selectClass}>
                <option value="">— Sin asignar —</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Categoría secundaria</label>
              <select value={secondaryCategory} onChange={(e) => setSecondaryCategory(e.target.value)} className={selectClass}>
                <option value="">— Sin asignar —</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contenido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Resumen (~100 palabras)</label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Resumen del contenido del documento..."
              rows={4}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Palabras clave</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {keywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="gap-1">
                  {kw}
                  <button onClick={() => handleRemoveKeyword(kw)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Nueva palabra clave..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddKeyword())}
              />
              <Button variant="outline" size="sm" onClick={handleAddKeyword}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Associated questions */}
      {questionCount !== null && questionCount > 0 && (
        <Card>
          <CardContent className="py-4">
            <Link
              href={`/questions?documentId=${documentId}`}
              className="flex items-center justify-between text-sm hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
            >
              <span className="flex items-center gap-2 text-foreground">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                {questionCount} pregunta{questionCount !== 1 ? "s" : ""} asociada{questionCount !== 1 ? "s" : ""}
              </span>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
        ) : (
          <><Save className="h-4 w-4" /> Guardar cambios</>
        )}
      </Button>
    </div>
  );
}
