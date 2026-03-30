"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Upload, FileText, Sparkles, MessageSquare, HelpCircle } from "lucide-react";

const navItems = [
  { href: "/upload", label: "Cargar PDFs", icon: Upload },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/enrich", label: "Enriquecer", icon: Sparkles },
  { href: "/chat", label: "Consultar", icon: MessageSquare },
  { href: "/questions", label: "Investigación", icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-neutral-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-neutral-700">
        <h1 className="text-xl font-bold">RAG Manager</h1>
        <p className="text-xs text-neutral-400 mt-1">Gestion de documentos + IA</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-neutral-700">
        <div className="text-xs text-neutral-500">
          <p>AWS Bedrock + pgvector</p>
          <p>Claude Opus 4.6</p>
        </div>
      </div>
    </aside>
  );
}
