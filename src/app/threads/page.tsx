"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Workflow,
  Plus,
  Trash2,
  ArrowRight,
  BookOpen,
  LayoutGrid,
} from "lucide-react";
import {
  Button,
  IconButton,
  Input,
  Textarea,
  FieldLabel,
  FieldHelp,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Badge,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui";

import { safeGet, safeSet, uid } from "@/lib/safe-storage";

interface Thread {
  id: string;
  title: string;
  description?: string;
  steps: Array<{ type: "question" | "production" | "note"; id?: string; text?: string; templateId?: string }>;
  createdAt: string;
}

const STORAGE_KEY = "rag-master-threads";

function loadThreads(): Thread[] {
  return safeGet<Thread[]>(STORAGE_KEY, []);
}

function saveThreads(t: Thread[]) {
  return safeSet(STORAGE_KEY, t);
}

export default function ThreadsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleError, setTitleError] = useState(false);

  useEffect(() => {
    setThreads(loadThreads());
    setLoading(false);
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setTitleError(false);
  };

  const createThread = () => {
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    const t: Thread = {
      id: uid("thr"),
      title: title.trim(),
      description: description.trim() || undefined,
      steps: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [...threads, t];
    setThreads(updated);
    saveThreads(updated);
    toast.success("Hilo creado");
    setShowNew(false);
    resetForm();
  };

  const removeThread = (id: string) => {
    const updated = threads.filter((t) => t.id !== id);
    setThreads(updated);
    saveThreads(updated);
    toast.success("Hilo eliminado");
    setConfirmDeleteId(null);
  };

  if (loading) {
    return (
      <div className="max-w-[var(--container-wide)] mx-auto px-8 py-8">
        <Skeleton variant="line" className="h-8 w-72 mb-3" />
        <Skeleton variant="line" className="h-4 w-full max-w-[600px] mb-6" />
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
      {/* Header */}
      <header className="flex justify-between items-end mb-6 flex-wrap gap-4">
        <div>
          <h1
            className="serif-title text-[36px] leading-tight m-0 text-[var(--color-ink-1000)] inline-flex items-center gap-3"
            style={{ fontWeight: 700 }}
          >
            <Workflow className="size-7 text-[var(--fg-muted)]" />
            Hilos de investigación
          </h1>
          <p className="text-[15px] leading-relaxed text-[var(--fg-muted)] mt-2 mb-0 max-w-[720px]">
            Encadena preguntas, producciones y notas en secuencias temáticas. Útil
            para construir argumentos largos o tesis encadenadas. Almacenamiento local.
          </p>
        </div>
        <Button
          variant="primary"
          leadingIcon={<Plus className="size-4" />}
          onClick={() => setShowNew(true)}
        >
          Nuevo hilo
        </Button>
      </header>

      {threads.length === 0 ? (
        <Card variant="default" size="md">
          <div className="py-10 text-center">
            <Workflow className="size-10 text-[var(--fg-subtle)] mx-auto mb-3" />
            <div className="text-[15px] font-medium text-[var(--fg-default)] mb-1">
              Aún no has creado hilos
            </div>
            <div className="text-[13px] text-[var(--fg-subtle)] mb-4">
              Crea tu primer hilo para encadenar preguntas, producciones y notas.
            </div>
            <Button
              variant="primary"
              leadingIcon={<Plus className="size-4" />}
              onClick={() => setShowNew(true)}
            >
              Crear primer hilo
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {threads.map((t) => {
            const questionCount = t.steps.filter((s) => s.type === "question").length;
            const productionCount = t.steps.filter((s) => s.type === "production").length;
            return (
              <Card key={t.id} variant="default" size="md" className="flex flex-col">
                <CardHeader className="flex-row items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Workflow className="size-4 text-[var(--fg-muted)] shrink-0" />
                    <CardTitle as="h4" className="text-[15px] truncate">
                      {t.title}
                    </CardTitle>
                  </div>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label="Eliminar hilo"
                    onClick={() => setConfirmDeleteId(t.id)}
                    className="text-[var(--color-danger-fg)] shrink-0"
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </CardHeader>

                <CardBody className="flex-1">
                  {t.description && (
                    <p className="text-[12.5px] leading-snug text-[var(--fg-muted)] line-clamp-2 mb-3">
                      {t.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="subtle" size="xs">
                      <BookOpen className="size-3" />
                      {questionCount} preguntas
                    </Badge>
                    <Badge variant="subtle" size="xs">
                      <LayoutGrid className="size-3" />
                      {productionCount} producciones
                    </Badge>
                  </div>
                </CardBody>

                <CardFooter className="border-t border-[var(--border-default)] pt-3 mt-4">
                  <Link href={`/threads/${t.id}`} className="ml-auto">
                    <Button variant="link" size="sm" trailingIcon={<ArrowRight className="size-3.5" />}>
                      Abrir hilo
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog: nuevo hilo */}
      <Dialog
        open={showNew}
        onOpenChange={(open) => {
          setShowNew(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Nuevo hilo de investigación</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <FieldLabel required htmlFor="thread-title">
                Título
              </FieldLabel>
              <Input
                id="thread-title"
                value={title}
                error={titleError}
                placeholder="Ej: La construcción del Estado-nación en el siglo XIX"
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleError) setTitleError(false);
                }}
                autoFocus
              />
              {titleError && (
                <FieldHelp error>Ingresa un título para el hilo.</FieldHelp>
              )}
            </div>
            <div>
              <FieldLabel htmlFor="thread-desc">Descripción (opcional)</FieldLabel>
              <Textarea
                id="thread-desc"
                rows={3}
                value={description}
                placeholder="Resumen del hilo de investigación…"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button variant="primary" onClick={createThread}>
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar borrado */}
      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Eliminar hilo</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-[14px] text-[var(--fg-muted)]">
              Esto borra el hilo localmente. Las preguntas y producciones
              referenciadas no se borran.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => confirmDeleteId && removeThread(confirmDeleteId)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
