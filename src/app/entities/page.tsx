"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  User,
  MapPin,
  BookOpen,
  Search,
  RotateCcw,
  AlertCircle,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  Input,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Pagination,
} from "@/components/ui";
import { cn } from "@/lib/cn";

interface Entity {
  name: string;
  mentions: number;
  docCount: number;
  questionCount?: number; // nuevo: desde /api/entities con source=questions
  pageCount?: number;     // legacy: desde NER por chunks
  type: "person" | "place" | "concept";
}

const TYPE_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  person: { icon: User, color: "#6366F1", label: "Persona" },
  place: { icon: MapPin, color: "#10B981", label: "Lugar" },
  concept: { icon: BookOpen, color: "#A855F7", label: "Concepto" },
};

const PAGE_SIZE = 48;

export default function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "person" | "place" | "concept">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [alertVisible, setAlertVisible] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/entities?limit=200&minMentions=3&sample=400")
      .then((r) => r.json())
      .then((d) => setEntities(d.entities ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = entities;
    if (filter !== "all") list = list.filter((e) => e.type === filter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));
    return list;
  }, [entities, filter, search]);

  // Reset paginación al cambiar filtros
  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const maxMentions = Math.max(1, ...entities.map((e) => e.mentions));

  return (
    <div className="app-page-wide">
      <div className="flex justify-between items-end mb-6 flex-wrap gap-3">
        <div>
          <h2
            className="serif-title text-[28px] m-0 flex items-center gap-2 text-[var(--color-ink-1000)]"
            style={{ fontWeight: 600 }}
          >
            <User className="size-6" /> Entidades del corpus
          </h2>
          <p className="text-[var(--fg-muted)] mt-1.5 mb-0 max-w-[720px] text-[14px] leading-relaxed">
            Personas, lugares y conceptos extraídos de las preguntas generadas (clasificadas por Claude Opus 4.7 — no heurística).
            Tamaño = nº de preguntas que la mencionan.
          </p>
        </div>
        <Button
          variant="secondary"
          leadingIcon={<RotateCcw className="size-4" />}
          onClick={load}
          isLoading={loading}
        >
          Recargar
        </Button>
      </div>

      {alertVisible && (
        <div
          className={cn(
            "mb-4 p-4 rounded-lg flex items-start gap-3",
            "border border-[var(--color-info-fg)]/40 bg-[var(--color-info-bg)]",
          )}
        >
          <AlertCircle className="size-4 text-[var(--color-info-fg)] mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-[var(--color-info-fg)]">
              Implementación heurística
            </div>
            <div className="text-sm text-[var(--color-info-fg)]/80 mt-0.5">
              La extracción usa regex sobre secuencias capitalizadas. Para producción, integrar un NER en español (spaCy es, Stanza o Claude prompting estructurado).
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setAlertVisible(false)}
            className={cn(
              "shrink-0 -m-1 p-1 rounded text-[var(--color-info-fg)]/70",
              "hover:text-[var(--color-info-fg)] hover:bg-[var(--color-info-fg)]/10",
              "transition-colors duration-[var(--duration-instant)]",
            )}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <Card variant="default" size="sm" className="mb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <Input
            placeholder="Buscar entidad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingIcon={<Search />}
            trailingIcon={
              search ? (
                <button
                  type="button"
                  aria-label="Limpiar"
                  onClick={() => setSearch("")}
                  className="text-[var(--fg-subtle)] hover:text-[var(--fg-default)] transition-colors"
                >
                  <X className="size-4" />
                </button>
              ) : undefined
            }
            wrapperClassName="w-[280px]"
          />
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList variant="segmented">
              <TabsTrigger variant="segmented" value="all">
                Todas
              </TabsTrigger>
              <TabsTrigger variant="segmented" value="person">
                <User className="size-3.5" /> Personas
              </TabsTrigger>
              <TabsTrigger variant="segmented" value="place">
                <MapPin className="size-3.5" /> Lugares
              </TabsTrigger>
              <TabsTrigger variant="segmented" value="concept">
                <BookOpen className="size-3.5" /> Conceptos
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>

      {loading ? (
        <Card variant="default" size="md">
          <div className="space-y-2">
            <Skeleton variant="line" className="h-4 w-2/3" />
            <Skeleton variant="line" className="h-3 w-full" />
            <Skeleton variant="line" className="h-3 w-full" />
            <Skeleton variant="line" className="h-3 w-5/6" />
            <Skeleton variant="line" className="h-3 w-full" />
            <Skeleton variant="line" className="h-3 w-4/6" />
            <Skeleton variant="line" className="h-3 w-full" />
            <Skeleton variant="line" className="h-3 w-3/4" />
            <Skeleton variant="line" className="h-3 w-full" />
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-[var(--fg-subtle)] text-sm">
          Sin entidades
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {paged.map((e) => {
            const cfg = TYPE_CONFIG[e.type];
            const Icon = cfg.icon;
            const intensity = e.mentions / maxMentions;
            const size = 12 + intensity * 12;
            return (
              <div
                key={e.name}
                className={cn(
                  "rounded-lg p-3.5 transition-shadow",
                  "bg-[var(--bg-page)] border border-[var(--border-default)] shadow-[var(--elev-1)]",
                  "hover:shadow-[var(--elev-2)] hover:border-[var(--border-strong)]",
                )}
                style={{ borderLeft: `3px solid ${cfg.color}` }}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span style={{ color: cfg.color }} className="shrink-0">
                      <Icon className="size-4" />
                    </span>
                    <span
                      className="font-semibold leading-tight text-[var(--fg-default)]"
                      style={{ fontSize: size }}
                    >
                      {e.name}
                    </span>
                  </div>
                  <span
                    className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] leading-none shrink-0"
                    style={{
                      background: `${cfg.color}1A`,
                      color: cfg.color,
                    }}
                  >
                    {e.mentions}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[var(--fg-subtle)]">
                  <span>{e.docCount} docs</span>
                  {(e.questionCount ?? e.pageCount) != null && (
                    <>
                      <span>·</span>
                      <span>
                        {e.questionCount != null
                          ? `${e.questionCount} preguntas`
                          : `${e.pageCount} pp`}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Link
                    href={`/questions?search=${encodeURIComponent(e.name)}`}
                    className="text-[11px] text-[var(--accent)] hover:text-[var(--accent-hover)] hover:underline underline-offset-4"
                  >
                    Preguntas →
                  </Link>
                  <Link
                    href={`/chat?q=${encodeURIComponent(e.name)}`}
                    className="text-[11px] text-[var(--accent)] hover:text-[var(--accent-hover)] hover:underline underline-offset-4"
                  >
                    Chat →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 mt-4">
          <span className="text-[12px] text-[var(--fg-subtle)]">
            {filtered.length.toLocaleString("es-CO")} entidades
          </span>
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onChange={(p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}
    </div>
  );
}
