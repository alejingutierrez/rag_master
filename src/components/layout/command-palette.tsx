"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import {
  Home,
  Upload,
  FileText,
  FlaskConical,
  BookOpen,
  MessageCircle,
  Lightbulb,
  Rocket,
  Workflow,
  BookMarked,
  LayoutGrid,
  GitCompare,
  Library,
  Activity,
  GitBranch,
  Map as MapIcon,
  Users,
  Search,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Kbd,
  Spinner,
} from "@/components/ui";

type Item = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "Navegar" | "Documentos" | "Preguntas" | "Producciones";
};

const STATIC_ITEMS: Item[] = [
  { id: "nav-home", label: "Inicio", href: "/", icon: Home, group: "Navegar" },
  { id: "nav-upload", label: "Cargar PDFs", href: "/upload", icon: Upload, group: "Navegar" },
  { id: "nav-docs", label: "Documentos", href: "/documents", icon: FileText, group: "Navegar" },
  { id: "nav-enrich", label: "Enriquecer", href: "/enrich", icon: FlaskConical, group: "Navegar" },
  { id: "nav-chat", label: "Consultar", href: "/chat", icon: MessageCircle, group: "Navegar" },
  { id: "nav-deep", label: "Deep Research", href: "/deep-research", icon: Rocket, group: "Navegar" },
  { id: "nav-hyp", label: "Hipótesis", href: "/hypothesis", icon: Lightbulb, group: "Navegar" },
  { id: "nav-q", label: "Preguntas", href: "/questions", icon: BookOpen, group: "Navegar" },
  { id: "nav-threads", label: "Hilos de investigación", href: "/threads", icon: Workflow, group: "Navegar" },
  { id: "nav-ws", label: "Workspaces", href: "/workspaces", icon: BookMarked, group: "Navegar" },
  { id: "nav-prod", label: "Producciones", href: "/producciones", icon: LayoutGrid, group: "Navegar" },
  { id: "nav-comp", label: "Comparador", href: "/compare", icon: GitCompare, group: "Navegar" },
  { id: "nav-bib", label: "Bibliografía", href: "/bibliography", icon: Library, group: "Navegar" },
  { id: "nav-time", label: "Línea de tiempo", href: "/timeline", icon: Activity, group: "Navegar" },
  { id: "nav-graph", label: "Grafo de conexiones", href: "/graph", icon: GitBranch, group: "Navegar" },
  { id: "nav-cov", label: "Cobertura temática", href: "/coverage", icon: MapIcon, group: "Navegar" },
  { id: "nav-ent", label: "Entidades", href: "/entities", icon: Users, group: "Navegar" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: string) => void;
}

export function CommandPalette({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [dynamicItems, setDynamicItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Búsqueda dinámica en docs/preguntas/producciones
  useEffect(() => {
    if (!open) return;
    if (!query || query.trim().length < 2) {
      setDynamicItems([]);
      setLoading(false);
      return;
    }
    fetchAbort.current?.abort();
    const ctrl = new AbortController();
    fetchAbort.current = ctrl;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/global?q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) {
          setDynamicItems([]);
          return;
        }
        const data = await res.json();
        const items: Item[] = [];
        for (const d of data.documents ?? []) {
          items.push({
            id: `doc-${d.id}`,
            label: d.title || d.filename,
            hint: `${d.pageCount ?? 0} pp · documento`,
            href: `/documents/${d.id}`,
            icon: FileText,
            group: "Documentos",
          });
        }
        for (const q of data.questions ?? []) {
          items.push({
            id: `q-${q.id}`,
            label: q.pregunta,
            hint: q.periodoNombre,
            href: `/questions?focus=${q.id}`,
            icon: BookOpen,
            group: "Preguntas",
          });
        }
        for (const p of data.producciones ?? []) {
          items.push({
            id: `p-${p.id}`,
            label: p.title,
            hint: p.templateName,
            href: `/producciones/${p.id}`,
            icon: LayoutGrid,
            group: "Producciones",
          });
        }
        setDynamicItems(items);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setDynamicItems([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, open]);

  const items = useMemo(
    () => [...STATIC_ITEMS, ...dynamicItems],
    [dynamicItems],
  );

  const grouped = useMemo(() => {
    const out = new Map<string, Item[]>();
    for (const it of items) {
      const arr = out.get(it.group) ?? [];
      arr.push(it);
      out.set(it.group, arr);
    }
    return out;
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="md"
        hideClose
        className="top-[20vh] translate-y-0 p-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
        <Command
          label="Búsqueda global"
          shouldFilter
          className="flex flex-col max-h-[60vh]"
        >
          <div className="flex items-center gap-2 px-4 h-12 border-b border-[var(--border-default)]">
            <Search className="size-4 text-[var(--fg-subtle)] shrink-0" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar documentos, preguntas, producciones…"
              className={cn(
                "flex-1 bg-transparent outline-none text-sm",
                "placeholder:text-[var(--fg-subtle)]",
                "text-[var(--fg-default)]",
              )}
            />
            {loading && <Spinner size={14} className="text-[var(--fg-subtle)]" />}
          </div>

          <Command.List className="flex-1 overflow-y-auto p-2">
            <Command.Empty className="py-10 text-center text-sm text-[var(--fg-subtle)]">
              {query ? "Sin resultados" : "Escribí para buscar"}
            </Command.Empty>

            {Array.from(grouped.entries()).map(([group, list]) => (
              <Command.Group
                key={group}
                heading={group}
                className={cn(
                  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5",
                  "[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium",
                  "[&_[cmdk-group-heading]]:text-[var(--fg-subtle)]",
                  "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider",
                )}
              >
                {list.map((it) => {
                  const Icon = it.icon;
                  return (
                    <Command.Item
                      key={it.id}
                      value={`${it.label} ${it.hint ?? ""}`}
                      onSelect={() => onNavigate(it.href)}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-md",
                        "text-sm cursor-pointer",
                        "data-[selected=true]:bg-[var(--bg-hover)] data-[selected=true]:text-[var(--fg-default)]",
                        "text-[var(--fg-muted)]",
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-[var(--fg-subtle)]" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[var(--fg-default)] font-medium">
                          {it.label}
                        </span>
                        {it.hint && (
                          <span className="block truncate text-[11px] text-[var(--fg-subtle)] mt-0.5">
                            {it.hint}
                          </span>
                        )}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>

          <div
            className={cn(
              "flex items-center gap-4 px-4 py-2",
              "border-t border-[var(--border-default)] bg-[var(--bg-subtle)]",
              "text-[11px] text-[var(--fg-subtle)]",
            )}
          >
            <span className="flex items-center gap-1.5">
              <Kbd keys="arrowup" /> <Kbd keys="arrowdown" /> navegar
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd keys="enter" /> abrir
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd keys="escape" /> cerrar
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
