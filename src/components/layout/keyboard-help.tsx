"use client";

import { useEffect, useState } from "react";
import { Modal, Typography, Space, theme } from "antd";

const { Text } = Typography;

interface Shortcut {
  keys: string[];
  label: string;
}

const SECTIONS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Global",
    items: [
      { keys: ["⌘", "K"], label: "Abrir búsqueda / paleta de comandos" },
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
      { keys: ["Esc"], label: "Salir de modo lectura" },
    ],
  },
];

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Modal open={open} onCancel={() => setOpen(false)} footer={null} title="Atajos de teclado" width={520}>
      <Space vertical size={20} style={{ width: "100%" }}>
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <Text
              strong
              style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: token.colorTextTertiary,
                display: "block",
                marginBottom: 8,
              }}
            >
              {s.title}
            </Text>
            <Space vertical size={8} style={{ width: "100%" }}>
              {s.items.map((it) => (
                <div
                  key={it.label}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
                >
                  <Text style={{ fontSize: 13 }}>{it.label}</Text>
                  <Space size={4}>
                    {it.keys.map((k, i) => (
                      <kbd key={i}>{k}</kbd>
                    ))}
                  </Space>
                </div>
              ))}
            </Space>
          </div>
        ))}
      </Space>
    </Modal>
  );
}
