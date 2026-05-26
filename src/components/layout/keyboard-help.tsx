"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  Kbd,
} from "@/components/ui";

interface Shortcut {
  keys: string[];
  label: string;
}

const SECTIONS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Global",
    items: [
      { keys: ["cmd", "k"], label: "Abrir búsqueda / paleta de comandos" },
      { keys: ["?"], label: "Mostrar atajos" },
      { keys: ["g", "h"], label: "Ir a Inicio" },
      { keys: ["g", "d"], label: "Ir a Documentos" },
      { keys: ["g", "c"], label: "Ir a Consultar" },
      { keys: ["g", "q"], label: "Ir a Preguntas" },
      { keys: ["g", "p"], label: "Ir a Producciones" },
      { keys: ["g", "t"], label: "Ir a Timeline" },
      { keys: ["g", "u"], label: "Ir a Cargar PDFs" },
    ],
  },
  {
    title: "Lectura / detalle",
    items: [
      { keys: ["f"], label: "Modo lectura (ocultar sider y header)" },
      { keys: ["escape"], label: "Salir de modo lectura" },
    ],
  },
];

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-5 pb-4">
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--fg-subtle)] font-semibold mb-2">
                  {s.title}
                </div>
                <div className="space-y-2">
                  {s.items.map((it) => (
                    <div
                      key={it.label}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-[13px] text-[var(--fg-default)]">
                        {it.label}
                      </span>
                      <span className="flex items-center gap-1">
                        {it.keys.map((k, i) => (
                          <Kbd key={i} keys={k} />
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
