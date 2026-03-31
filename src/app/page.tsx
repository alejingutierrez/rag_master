"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { StatCard } from "@/components/domain/stat-card";
import { StatusBadge } from "@/components/domain/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDocumentDisplayName } from "@/lib/enrichment-types";
import {
  FileText,
  Layers,
  HelpCircle,
  MessageSquare,
  Upload,
  BookOpen,
  ArrowRight,
} from "lucide-react";

interface DashboardData {
  stats: {
    documents: number;
    chunks: number;
    questions: number;
    conversations: number;
  };
  recentDocuments: {
    id: string;
    filename: string;
    status: string;
    pageCount: number;
    createdAt: string;
    _count: { chunks: number };
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Archivo Historico Digital</h1>
          <p className="text-muted-foreground mt-1">
            Panel de control del sistema RAG para investigacion historica
          </p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Documentos" value={data.stats.documents} icon={FileText} />
            <StatCard label="Chunks" value={data.stats.chunks.toLocaleString()} icon={Layers} />
            <StatCard label="Preguntas" value={data.stats.questions} icon={HelpCircle} />
            <StatCard label="Consultas" value={data.stats.conversations} icon={MessageSquare} />
          </div>
        ) : null}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent documents */}
          <div className="lg:col-span-2 rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">Documentos recientes</h2>
              <Link href="/documents" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-md" />
                ))}
              </div>
            ) : data && data.recentDocuments.length > 0 ? (
              <div className="space-y-1">
                {data.recentDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-surface-hover transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {getDocumentDisplayName(doc)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc._count.chunks} chunks &middot; {doc.pageCount} paginas
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={doc.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay documentos cargados aun
              </p>
            )}
          </div>

          {/* Quick actions */}
          <div className="space-y-3">
            <h2 className="font-semibold text-foreground">Acciones rapidas</h2>
            <QuickAction href="/upload" icon={Upload} label="Cargar PDFs" description="Sube documentos para analizar" />
            <QuickAction href="/chat" icon={MessageSquare} label="Consultar" description="Pregunta sobre tus documentos" />
            <QuickAction href="/questions" icon={BookOpen} label="Investigacion" description="Explora preguntas generadas" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function QuickAction({ href, icon: Icon, label, description }: {
  href: string;
  icon: React.ElementType;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:bg-surface-hover hover:border-border-hover transition-colors group"
    >
      <div className="rounded-md bg-primary/10 p-2">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
