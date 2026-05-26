"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BookMarked,
  Plus,
  Trash2,
  ArrowRight,
  FileText,
  BookOpen,
  LayoutGrid,
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
  FieldHelp,
  FieldLabel,
  IconButton,
  Input,
  Skeleton,
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

import { safeGet, safeSet, uid } from "@/lib/safe-storage";
import dayjs from "@/lib/dayjs-config";

const STORAGE_KEY = "rag-master-workspaces";

function loadWS(): Workspace[] {
  return safeGet<Workspace[]>(STORAGE_KEY, []);
}

function saveWS(w: Workspace[]) {
  return safeSet(STORAGE_KEY, w);
}

export default function WorkspacesPage() {
  const [ws, setWs] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Workspace | null>(null);

  useEffect(() => {
    setWs(loadWS());
    setLoading(false);
  }, []);

  const create = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    const newWs: Workspace = {
      id: uid("ws"),
      name: name.trim(),
      description: description.trim() || undefined,
      pinned: { documents: [], questions: [], productions: [] },
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...ws, newWs];
    setWs(updated);
    saveWS(updated);
    toast.success("Workspace creado");
    setShowNew(false);
    setName("");
    setDescription("");
    setNameError(false);
  };

  const remove = (id: string) => {
    const updated = ws.filter((w) => w.id !== id);
    setWs(updated);
    saveWS(updated);
    toast.success("Eliminado");
    setConfirmDelete(null);
  };

  if (loading) {
    return (
      <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
        <Skeleton variant="line" className="h-8 w-72 mb-3" />
        <Skeleton variant="line" className="h-4 w-[480px] mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton variant="line" className="h-40" />
          <Skeleton variant="line" className="h-40" />
          <Skeleton variant="line" className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)]">
            Espacios de trabajo
          </div>
          <h1
            className="serif-title text-[36px] leading-tight mt-1.5 mb-2 text-[var(--color-ink-1000)] flex items-center gap-3"
            style={{ fontWeight: 700 }}
          >
            <BookMarked className="size-8 text-[var(--accent)]" />
            Workspaces de investigación
          </h1>
          <p className="text-[15px] leading-relaxed text-[var(--fg-muted)] max-w-[720px]">
            Agrupa documentos, preguntas y producciones de un proyecto. Añade
            notas Markdown libres. Persistencia local — pensados como sesiones
            de trabajo nombradas.
          </p>
        </div>
        <Button
          variant="primary"
          leadingIcon={<Plus />}
          onClick={() => setShowNew(true)}
        >
          Nuevo workspace
        </Button>
      </header>

      {ws.length === 0 ? (
        <Card variant="default" size="lg">
          <div className="py-10 text-center">
            <BookMarked className="size-10 mx-auto mb-3 text-[var(--fg-subtle)]" />
            <div className="text-[15px] font-medium text-[var(--fg-default)] mb-1">
              Aún no has creado workspaces
            </div>
            <div className="text-[13px] text-[var(--fg-subtle)] mb-4">
              Crea tu primero para agrupar fuentes, preguntas y producciones.
            </div>
            <Button
              variant="primary"
              leadingIcon={<Plus />}
              onClick={() => setShowNew(true)}
            >
              Crear primero
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ws.map((w) => (
            <Card key={w.id} variant="default" size="md" className="flex flex-col">
              <header className="flex items-start justify-between gap-2 mb-3">
                <h3 className="text-[15px] font-semibold text-[var(--fg-default)] leading-snug flex-1 min-w-0">
                  {w.name}
                </h3>
                <IconButton
                  size="sm"
                  variant="danger"
                  aria-label="Eliminar workspace"
                  onClick={() => setConfirmDelete(w)}
                >
                  <Trash2 />
                </IconButton>
              </header>

              {w.description && (
                <p className="text-[12.5px] leading-snug text-[var(--fg-muted)] mb-3 line-clamp-2">
                  {w.description}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5 mb-3">
                <Badge variant="subtle" size="xs">
                  <FileText className="size-3" />
                  {w.pinned.documents.length} docs
                </Badge>
                <Badge variant="subtle" size="xs">
                  <BookOpen className="size-3" />
                  {w.pinned.questions.length} preguntas
                </Badge>
                <Badge variant="subtle" size="xs">
                  <LayoutGrid className="size-3" />
                  {w.pinned.productions.length} prods
                </Badge>
              </div>

              <div className="text-[11px] text-[var(--fg-subtle)] mb-4">
                Actualizado {dayjs(w.updatedAt).format("DD MMM YY")}
              </div>

              <div className="mt-auto pt-3 border-t border-[var(--border-default)]">
                <Link
                  href={`/workspaces/${w.id}`}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] hover:underline"
                >
                  Abrir <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: nuevo workspace */}
      <Dialog
        open={showNew}
        onOpenChange={(open) => {
          setShowNew(open);
          if (!open) {
            setName("");
            setDescription("");
            setNameError(false);
          }
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Nuevo workspace</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <FieldLabel htmlFor="ws-name" required>
                  Nombre
                </FieldLabel>
                <Input
                  id="ws-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(false);
                  }}
                  placeholder="Ej: Tesis sobre el Frente Nacional"
                  error={nameError}
                  autoFocus
                />
                {nameError && (
                  <FieldHelp error>El nombre es obligatorio.</FieldHelp>
                )}
              </div>
              <div>
                <FieldLabel htmlFor="ws-desc">
                  Descripción (opcional)
                </FieldLabel>
                <Textarea
                  id="ws-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button variant="primary" onClick={create}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar borrado */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Eliminar workspace</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-[var(--fg-muted)]">
              Los items referenciados no se borran, solo el contenedor.
            </p>
            {confirmDelete && (
              <p className="text-sm mt-2 font-medium text-[var(--fg-default)]">
                “{confirmDelete.name}”
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => confirmDelete && remove(confirmDelete.id)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
