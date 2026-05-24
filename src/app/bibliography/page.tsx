"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  Typography,
  Space,
  Button,
  Segmented,
  theme,
  Skeleton,
  Empty,
  Tag,
  App,
} from "antd";
import {
  BookOutlined,
  CopyOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

interface BibData {
  citations: Array<{ author: string; year: string; title: string; publisher?: string; raw: string }>;
  formatted: string[];
  style: "apa" | "chicago";
}

export default function BibliographyPage() {
  return (
    <Suspense fallback={<div className="app-page"><Skeleton active /></div>}>
      <BibContent />
    </Suspense>
  );
}

function BibContent() {
  const params = useSearchParams();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const deliverableId = params.get("deliverable");

  const [style, setStyle] = useState<"apa" | "chicago">("apa");
  const [data, setData] = useState<BibData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ style });
    if (deliverableId) p.set("deliverable", deliverableId);
    fetch(`/api/bibliography?${p}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [style, deliverableId]);

  useEffect(() => {
    load();
  }, [load]);

  const copyAll = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.formatted.join("\n\n"));
    message.success(`${data.formatted.length} referencias copiadas`);
  };

  const downloadTxt = () => {
    if (!data) return;
    const blob = new Blob([data.formatted.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bibliografia-${style}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBib = () => {
    if (!data) return;
    const bib = data.citations
      .map((c, i) => {
        const key = `${(c.author.split(",")[0] || "anon").toLowerCase().replace(/[^a-z]/g, "")}${c.year}_${i}`;
        return `@book{${key},
  author = {${c.author}},
  title = {${c.title}},
  year = {${c.year}}${c.publisher ? `,\n  publisher = {${c.publisher}}` : ""}
}`;
      })
      .join("\n\n");
    const blob = new Blob([bib], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bibliografia.bib";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={2} className="serif-title" style={{ margin: 0 }}>
            <BookOutlined /> Bibliografía
          </Title>
          <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0", maxWidth: 720 }}>
            {deliverableId
              ? "Referencias de la producción seleccionada, formateadas según el estilo elegido."
              : "Referencias bibliográficas de todo el corpus. Útil para citar en textos académicos."}
          </Paragraph>
        </div>
        <Space>
          <Segmented
            value={style}
            onChange={(v) => setStyle(v as "apa" | "chicago")}
            options={[
              { value: "apa", label: "APA 7" },
              { value: "chicago", label: "Chicago" },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={load} />
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button icon={<CopyOutlined />} onClick={copyAll} disabled={!data || data.formatted.length === 0}>
            Copiar todo ({data?.formatted.length ?? 0})
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadTxt} disabled={!data}>
            Descargar .txt
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadBib} disabled={!data}>
            Descargar .bib
          </Button>
        </Space>
      </Card>

      <Card>
        {loading ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : !data || data.formatted.length === 0 ? (
          <Empty description="Sin referencias" />
        ) : (
          <Space vertical size={12} style={{ width: "100%" }}>
            {data.formatted.map((entry, i) => (
              <div
                key={i}
                style={{
                  paddingLeft: 24,
                  textIndent: -24,
                  fontFamily: "var(--font-serif)",
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: token.colorText,
                }}
              >
                {entry}
              </div>
            ))}
          </Space>
        )}
      </Card>
    </div>
  );
}
