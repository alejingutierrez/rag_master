"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  BookOpen,
  LayoutGrid,
  Save,
  Pencil,
  Search,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
  IconButton,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";

interface Workspace {
  id: string;
  name: string;
  description?: string;
  pinned: { documents: string[]; questions: string[]; productions: string[] };
  notes: string;
  createdAt: string;
  updatedAt: string;
}

import { safeGet, safeSet } from "@/lib/safe-storage";

const STORAGE_KEY = "rag-master-workspaces";

function loadWS(): Workspace[] {
  return safeGet<Workspace[]>(STORAGE_KEY, []);
}
function saveWS(w: Workspace[]) {
  return safeSet(STORAGE_KEY, w);
}

type PinKind = "documents" | "questions" | "productions";

export default function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [docs, setDocs] = useState<Array<{ id: string; filename: string }>>(
    [],
  );
  const [questions, setQuestions] = useState<
    Array<{ id: string; pregunta: string }>
  >([]);
  const [productions, setProductions] = useState<
    Array<{
      id: string;
      templateId: string;
      userQuestion?: string;
      question?: { pregunta: string };
    }>
  >([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [showAdd, setShowAdd] = useState<PinKind | null>(null);

  useEffect(() => {
    const all = loadWS();
    const found = all.find((w) => w.id === id) ?? null;
    if (!found) {
      setNotFound(true);
    } else {
      setWs(found);
      setNotesDraft(found.notes);
    }
  }, [id]);

  useEffect(() => {
    Promise.all([
      fetch("/api/documents?limit=300")
        .then((r) => r.json())
        .then((d) => setDocs(d.documents ?? [])),
      fetch("/api/questions?limit=300")
        .then((r) => r.json())
        .then((d) => setQuestions(d.questions ?? [])),
      fetch("/api/deliverables?limit=100")
        .then((r) => r.json())
        .then((d) => setProductions(d.deliverables ?? [])),
    ]).catch(console.error);
  }, []);

  if (notFound) {
    return (
      <div className="max-w-[var(--container)] mx-auto px-8 py-8">
        <Card variant="default" size="lg">
          <div className="py-10 text-center">
            <div className="text-[15px] font-medium text-[var(--fg-default)] mb-2">
              Workspace no encontrado
            </div>
            <Link
              href="/workspaces"
              className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="size-3.5" /> Volver a workspaces
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!ws) {
    return (
      <div className="max-w-[var(--container)] mx-auto px-8 py-8">
        <div className="text-[13px] text-[var(--fg-subtle)]">Cargando…</div>
      </div>
    );
  }

  const persist = (updated: Workspace) => {
    const next = { ...updated, updatedAt: new Date().toISOString() };
    setWs(next);
    const all = loadWS().map((w) => (w.id === id ? next : w));
    saveWS(all);
  };

  const togglePin = (kind: PinKind, refId: string) => {
    const arr = ws.pinned[kind];
    const next = arr.includes(refId)
      ? arr.filter((x) => x !== refId)
      : [...arr, refId];
    persist({ ...ws, pinned: { ...ws.pinned, [kind]: next } });
  };

  const saveNotes = () => {
    persist({ ...ws, notes: notesDraft });
    setEditingNotes(false);
    toast.success("Notas guardadas");
  };

  const pinnedDocs = docs.filter((d) => ws.pinned.documents.includes(d.id));
  const pinnedQs = questions.filter((q) =>
    ws.pinned.questions.includes(q.id),
  );
  const pinnedProds = productions.filter((p) =>
    ws.pinned.productions.includes(p.id),
  );

  return (
    <div className="max-w-[var(--container)] mx-auto px-8 py-8">
      <Link
        href="/workspaces"
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--fg-muted)] hover:text-[var(--fg-default)] mb-4"
      >
        <ArrowLeft className="size-3.5" /> Volver a workspaces
      </Link>

      <header className="mb-6">
        <h1
          className="serif-title text-[36px] leading-tight text-[var(--color-ink-1000)]"
          style={{ fontWeight: 700 }}
        >
          {ws.name}
        </h1>
        {ws.description && (
          <p className="text-[15px] leading-relaxed text-[var(--fg-muted)] mt-2 max-w-[720px]">
            {ws.description}
          </p>
        )}
      </header>

      <Tabs defaultValue="docs" className="w-full">
        <TabsList>
          <TabsTrigger value="docs">
            <FileText className="size-3.5" />
            Documentos
            <Badge variant="subtle" size="xs" className="ml-1">
              {pinnedDocs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="qs">
            <BookOpen className="size-3.5" />
            Preguntas
            <Badge variant="subtle" size="xs" className="ml-1">
              {pinnedQs.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="prods">
            <LayoutGrid className="size-3.5" />
            Producciones
            <Badge variant="subtle" size="xs" className="ml-1">
              {pinnedProds.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="notes">
            <Pencil className="size-3.5" />
            Notas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="docs">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Plus />}
            onClick={() => setShowAdd("documents")}
            className="mb-3"
          >
            Anclar documentos
          </Button>
          {pinnedDocs.length === 0 ? (
            <EmptyPinned label="Sin documentos anclados" />
          ) : (
            <div className="space-y-2">
              {pinnedDocs.map((d) => (
                <Card
                  key={d.id}
                  variant="default"
                  size="sm"
                  className="flex items-center justify-between gap-3"
                >
                  <Link
                    href={`/documents/${d.id}`}
                    className="flex items-center gap-2 min-w-0 flex-1 text-[13px] text-[var(--fg-default)] hover:text-[var(--accent)] transition-colors"
                  >
                    <FileText className="size-4 shrink-0 text-[var(--fg-subtle)]" />
                    <span className="truncate">{d.filename}</span>
                  </Link>
                  <IconButton
                    size="sm"
                    variant="danger"
                    aria-label="Quitar documento"
                    onClick={() => togglePin("documents", d.id)}
                  >
                    <Trash2 />
                  </IconButton>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="qs">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Plus />}
            onClick={() => setShowAdd("questions")}
            className="mb-3"
          >
            Anclar preguntas
          </Button>
          {pinnedQs.length === 0 ? (
            <EmptyPinned label="Sin preguntas ancladas" />
          ) : (
            <div className="space-y-2">
              {pinnedQs.map((q) => (
                <Card
                  key={q.id}
                  variant="default"
                  size="sm"
                  className="flex items-center justify-between gap-3"
                >
                  <span
                    className="text-[13px] text-[var(--fg-default)] leading-snug flex-1"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {q.pregunta}
                  </span>
                  <IconButton
                    size="sm"
                    variant="danger"
                    aria-label="Quitar pregunta"
                    onClick={() => togglePin("questions", q.id)}
                  >
                    <Trash2 />
                  </IconButton>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="prods">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Plus />}
            onClick={() => setShowAdd("productions")}
            className="mb-3"
          >
            Anclar producciones
          </Button>
          {pinnedProds.length === 0 ? (
            <EmptyPinned label="Sin producciones ancladas" />
          ) : (
            <div className="space-y-2">
              {pinnedProds.map((p) => (
                <Card
                  key={p.id}
                  variant="default"
                  size="sm"
                  className="flex items-center justify-between gap-3"
                >
                  <Link
                    href={`/producciones/${p.id}`}
                    className="text-[13px] text-[var(--fg-default)] hover:text-[var(--accent)] transition-colors flex-1 min-w-0 truncate"
                  >
                    {p.question?.pregunta ?? p.userQuestion ?? "(producción)"}
                  </Link>
                  <IconButton
                    size="sm"
                    variant="danger"
                    aria-label="Quitar producción"
                    onClick={() => togglePin("productions", p.id)}
                  >
                    <Trash2 />
                  </IconButton>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes">
          <Card variant="default" size="md">
            <header className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-[var(--fg-default)]">
                Notas
              </h3>
              {editingNotes ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingNotes(false);
                      setNotesDraft(ws.notes);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon={<Save />}
                    onClick={saveNotes}
                  >
                    Guardar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<Pencil />}
                  onClick={() => setEditingNotes(true)}
                >
                  Editar
                </Button>
              )}
            </header>

            {editingNotes ? (
              <Textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={16}
                placeholder="Notas en Markdown sobre este workspace…"
              />
            ) : ws.notes ? (
              <div className="prose-academic text-sm">
                <ReactMarkdown>{ws.notes}</ReactMarkdown>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Pencil className="size-8 mx-auto mb-2 text-[var(--fg-subtle)]" />
                <div className="text-[13px] text-[var(--fg-subtle)]">
                  Sin notas — haz click en Editar
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <PinDialog
        show={showAdd}
        onClose={() => setShowAdd(null)}
        onPin={(refId) => {
          if (showAdd) togglePin(showAdd, refId);
        }}
        docs={docs}
        questions={questions}
        productions={productions}
        ws={ws}
      />
    </div>
  );
}

function EmptyPinned({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-[13px] text-[var(--fg-subtle)] border border-dashed border-[var(--border-default)] rounded-lg">
      {label}
    </div>
  );
}

function PinDialog({
  show,
  onClose,
  onPin,
  docs,
  questions,
  productions,
  ws,
}: {
  show: PinKind | null;
  onClose: () => void;
  onPin: (id: string) => void;
  docs: Array<{ id: string; filename: string }>;
  questions: Array<{ id: string; pregunta: string }>;
  productions: Array<{
    id: string;
    templateId: string;
    question?: { pregunta: string };
    userQuestion?: string;
  }>;
  ws: Workspace;
}) {
  const [selected, setSelected] = useState<string | undefined>();
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    if (!show) return [] as Array<{ value: string; label: string }>;
    if (show === "documents") {
      return docs
        .filter((d) => !ws.pinned.documents.includes(d.id))
        .map((d) => ({ value: d.id, label: d.filename }));
    }
    if (show === "questions") {
      return questions
        .filter((q) => !ws.pinned.questions.includes(q.id))
        .map((q) => ({ value: q.id, label: q.pregunta.slice(0, 140) }));
    }
    return productions
      .filter((p) => !ws.pinned.productions.includes(p.id))
      .map((p) => ({
        value: p.id,
        label: (
          p.question?.pregunta ??
          p.userQuestion ??
          "(producción)"
        ).slice(0, 140),
      }));
  }, [show, docs, questions, productions, ws]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const title =
    show === "documents"
      ? "Anclar documento"
      : show === "questions"
      ? "Anclar pregunta"
      : show === "productions"
      ? "Anclar producción"
      : "";

  return (
    <Dialog
      open={!!show}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setSelected(undefined);
          setQuery("");
        }
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar…"
            leadingIcon={<Search />}
            trailingIcon={
              query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-[var(--fg-subtle)] hover:text-[var(--fg-default)]"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="size-4" />
                </button>
              ) : undefined
            }
          />
          <div className="mt-3 max-h-[320px] overflow-auto border border-[var(--border-default)] rounded-md">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-[var(--fg-subtle)]">
                Sin resultados
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border-default)]">
                {filtered.map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => setSelected(o.value)}
                      className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${
                        selected === o.value
                          ? "bg-[var(--accent-bg-subtle)] text-[var(--color-tinta-700)]"
                          : "text-[var(--fg-default)] hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      {o.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button
            variant="primary"
            disabled={!selected}
            onClick={() => {
              if (selected) {
                onPin(selected);
                setSelected(undefined);
                setQuery("");
              }
              onClose();
            }}
          >
            Anclar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
