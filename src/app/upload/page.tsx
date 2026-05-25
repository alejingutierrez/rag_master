"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload,
  Card,
  Typography,
  Space,
  Button,
  Progress,
  Steps,
  Tag,
  Alert,
  theme,
  App,
  Row,
  Col,
  Statistic,
  Empty,
} from "antd";
import {
  InboxOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
  ApartmentOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  LoadingOutlined,
  ReloadOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import type { RcFile } from "antd/es/upload";
import Link from "next/link";
import { EyeOutlined } from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

type FileStatus =
  | "queued"
  | "hashing"
  | "uploading"
  | "processing"
  | "embedding"
  | "success"
  | "error"
  | "duplicate";

interface FileUploadState {
  id: string;
  file: File;
  status: FileStatus;
  message: string;
  chunkCount?: number;
  embeddingProgress?: { processed: number; total: number };
  documentId?: string;
}

const LARGE_FILE_MB = 50;

// Unidad: PALABRAS (chunking cross-page por palabras desde 2026-05-25)
const CHUNK_CONFIG = {
  chunkSize: 2000,
  chunkOverlap: 500,
  strategy: "FIXED" as const,
};

const CONCURRENCY = 2;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 2000;
const POLLING_INTERVAL = 4000;
const POLLING_TIMEOUT = 20 * 60 * 1000;

async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY * 2 ** attempt + Math.random() * 1000));
          continue;
        }
      }
      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY * 2 ** attempt + Math.random() * 1000));
        continue;
      }
    }
  }
  throw lastError || new Error("Fetch failed after retries");
}

const PIPELINE_STEPS = [
  { key: "queued", title: "En cola", icon: <FileTextOutlined /> },
  { key: "hashing", title: "Hash SHA-256", icon: <CopyOutlined /> },
  { key: "uploading", title: "Subir a S3", icon: <CloudUploadOutlined /> },
  { key: "processing", title: "Chunking", icon: <ApartmentOutlined /> },
  { key: "embedding", title: "Embeddings", icon: <ExperimentOutlined /> },
  { key: "success", title: "Listo", icon: <CheckCircleOutlined /> },
];

function pipelineStepIndex(s: FileStatus): number {
  const idx = PIPELINE_STEPS.findIndex((p) => p.key === s);
  return idx === -1 ? 0 : idx;
}

export default function UploadPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [states, setStates] = useState<FileUploadState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortRef = useRef(false);
  const sessionHashesRef = useRef<Set<string>>(new Set());

  const updateState = (id: string, update: Partial<FileUploadState>) => {
    setStates((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
  };

  const removeState = (id: string) => {
    setStates((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClear = useCallback(() => {
    setStates([]);
    abortRef.current = false;
    sessionHashesRef.current.clear();
  }, []);

  const uploadSingle = async (state: FileUploadState) => {
    const { file, id } = state;
    if (abortRef.current) return;
    try {
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > LARGE_FILE_MB) {
        updateState(id, {
          status: "hashing",
          message: `Archivo grande (${sizeMB.toFixed(1)} MB). Calculando hash, puede tardar 10‑30s…`,
        });
      } else {
        updateState(id, { status: "hashing", message: "Calculando hash SHA-256…" });
      }
      const fileHash = await computeFileHash(file);

      if (sessionHashesRef.current.has(fileHash)) {
        updateState(id, { status: "duplicate", message: "Duplicado en esta carga (mismo contenido)." });
        return;
      }

      const checkRes = await fetchWithRetry("/api/documents/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileHash, filename: file.name }),
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.isDuplicate) {
          updateState(id, {
            status: "duplicate",
            message: `Ya existe en el sistema como "${checkData.existingFilename}".`,
          });
          return;
        }
      }
      sessionHashesRef.current.add(fileHash);

      updateState(id, { status: "uploading", message: "Obteniendo URL de subida…" });
      const presignRes = await fetchWithRetry("/api/documents/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!presignRes.ok) throw new Error("Error al obtener URL de subida");
      const { url, s3Key, s3Url } = await presignRes.json();

      updateState(id, { message: "Subiendo a S3…" });
      const uploadRes = await fetchWithRetry(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Error al subir a S3 (${uploadRes.status})`);

      updateState(id, { status: "processing", message: "Parseando PDF y creando chunks…" });
      const processRes = await fetchWithRetry("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Key,
          s3Url,
          filename: file.name,
          fileSize: file.size,
          fileHash,
          ...CHUNK_CONFIG,
        }),
      });
      if (!processRes.ok) {
        const err = await processRes.json().catch(() => ({ error: `HTTP ${processRes.status}` }));
        throw new Error(err.error || "Error al procesar");
      }
      const data = await processRes.json();
      const documentId = data.document.id;
      const chunkCount = data.document._count?.chunks ?? 0;
      updateState(id, { documentId });

      await fetchWithRetry(`/api/documents/${documentId}/process`, { method: "POST" });

      updateState(id, {
        status: "embedding",
        message: `Generando embeddings: 0/${chunkCount}`,
        chunkCount,
        embeddingProgress: { processed: 0, total: chunkCount },
      });

      const pollingStart = Date.now();
      let consecutiveErrors = 0;
      while (!abortRef.current) {
        await new Promise((r) => setTimeout(r, POLLING_INTERVAL));
        if (Date.now() - pollingStart > POLLING_TIMEOUT) {
          updateState(id, {
            status: "success",
            message: `${chunkCount} chunks — embeddings continuando en servidor`,
            chunkCount,
          });
          return;
        }
        try {
          const progressRes = await fetch(`/api/documents/${documentId}/process`);
          if (!progressRes.ok) {
            if (++consecutiveErrors >= 10) {
              updateState(id, { status: "success", message: "Embeddings continuando en background", chunkCount });
              return;
            }
            continue;
          }
          consecutiveErrors = 0;
          const progress = await progressRes.json();
          updateState(id, {
            message: `Generando embeddings: ${progress.processedChunks}/${progress.totalChunks}`,
            embeddingProgress: { processed: progress.processedChunks, total: progress.totalChunks },
          });
          if (progress.status === "READY") break;
          if (progress.status === "ERROR") throw new Error("Error al generar embeddings");
        } catch (e) {
          if (e instanceof Error && e.message === "Error al generar embeddings") throw e;
          if (++consecutiveErrors >= 10) {
            updateState(id, { status: "success", message: "Embeddings continuando en background", chunkCount });
            return;
          }
        }
      }

      updateState(id, {
        status: "success",
        message: `${chunkCount} chunks con embeddings`,
        chunkCount,
        embeddingProgress: { processed: chunkCount, total: chunkCount },
      });
    } catch (err) {
      updateState(id, {
        status: "error",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  };

  const draggerProps: UploadProps = {
    name: "file",
    multiple: true,
    accept: ".pdf,application/pdf",
    showUploadList: false,
    beforeUpload: (file: RcFile, fileList: RcFile[]) => {
      const newFiles = fileList.filter((f) => f.type === "application/pdf");
      const newStates: FileUploadState[] = newFiles.map((f) => ({
        id: `${f.name}-${f.size}-${f.lastModified}-${Math.random()}`,
        file: f,
        status: "queued",
        message: "En cola",
      }));
      // Dedup contra estado actual
      setStates((prev) => {
        const existing = new Set(prev.map((s) => `${s.file.name}|${s.file.size}`));
        const filtered = newStates.filter((s) => !existing.has(`${s.file.name}|${s.file.size}`));
        if (filtered.length < newStates.length) {
          message.info(`${newStates.length - filtered.length} duplicados ya en la lista`);
        }
        return [...prev, ...filtered];
      });
      return Upload.LIST_IGNORE;
    },
  };

  const startUpload = async () => {
    const pendingStates = states.filter((s) => s.status === "queued" || s.status === "error");
    if (pendingStates.length === 0) return;
    setIsProcessing(true);
    abortRef.current = false;
    const queue = [...pendingStates];
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0 && !abortRef.current) {
        const item = queue.shift();
        if (!item) break;
        await uploadSingle(item);
      }
    });
    await Promise.all(workers);
    setIsProcessing(false);
  };

  const successCount = states.filter((s) => s.status === "success").length;
  const errorCount = states.filter((s) => s.status === "error").length;
  const dupCount = states.filter((s) => s.status === "duplicate").length;
  const totalChunks = states.reduce((s, x) => s + (x.chunkCount ?? 0), 0);
  const pendingCount = states.filter((s) => s.status === "queued" || s.status === "error").length;

  return (
    <div className="app-page-narrow">
      <div style={{ marginBottom: 24 }}>
        <Title level={2} className="serif-title" style={{ margin: 0 }}>
          Cargar PDFs
        </Title>
        <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0" }}>
          Sube fuentes históricas. El sistema calcula el hash para evitar duplicados, las divide en chunks de 3000 caracteres con overlap de 750, y genera embeddings con Cohere Embed v4.
        </Paragraph>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <Dragger {...draggerProps} disabled={isProcessing}>
          <p className="ant-upload-drag-icon" style={{ color: token.colorPrimary }}>
            <InboxOutlined style={{ fontSize: 48 }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500 }}>
            Arrastra PDFs aquí o haz click para seleccionar
          </p>
          <p className="ant-upload-hint" style={{ color: token.colorTextTertiary }}>
            Soporta múltiples archivos. El procesamiento es paralelo (concurrencia {CONCURRENCY}).
          </p>
        </Dragger>
      </Card>

      {states.length > 0 && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={12} md={6}>
                <Statistic title="En cola" value={pendingCount} valueStyle={{ fontSize: 22 }} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Listos" value={successCount} valueStyle={{ fontSize: 22, color: token.colorSuccess }} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Duplicados" value={dupCount} valueStyle={{ fontSize: 22, color: token.colorWarning }} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Chunks totales" value={totalChunks} valueStyle={{ fontSize: 22 }} />
              </Col>
            </Row>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Button
                type="primary"
                icon={isProcessing ? <LoadingOutlined /> : <CloudUploadOutlined />}
                onClick={startUpload}
                disabled={isProcessing || pendingCount === 0}
                size="large"
              >
                {isProcessing
                  ? "Procesando…"
                  : `Subir y procesar ${pendingCount} archivo${pendingCount !== 1 ? "s" : ""}`}
              </Button>
              {isProcessing && (
                <Button icon={<CloseCircleOutlined />} onClick={() => (abortRef.current = true)}>
                  Detener
                </Button>
              )}
              {!isProcessing && (
                <Button icon={<ClearOutlined />} onClick={handleClear}>
                  Limpiar
                </Button>
              )}
            </div>
          </Card>

          {successCount > 0 && !isProcessing && errorCount === 0 && (
            <Alert
              showIcon
              type="success"
              message={`${successCount} archivo${successCount !== 1 ? "s" : ""} procesado${successCount !== 1 ? "s" : ""}`}
              description={`${totalChunks} chunks creados y vectorizados. Ya puedes consultarlos en /chat o generar preguntas.`}
              style={{ marginBottom: 16 }}
            />
          )}

          <Space vertical size={10} style={{ width: "100%" }}>
            {states.map((s) => (
              <FileRow
                key={s.id}
                state={s}
                onRemove={() => removeState(s.id)}
                onRetry={() => uploadSingle(s)}
                disabled={isProcessing}
              />
            ))}
          </Space>
        </>
      )}

      {states.length === 0 && (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Arrastra archivos arriba para comenzar"
          />
        </Card>
      )}
    </div>
  );
}

function FileRow({
  state,
  onRemove,
  onRetry,
  disabled,
}: {
  state: FileUploadState;
  onRemove: () => void;
  onRetry: () => void;
  disabled: boolean;
}) {
  const { token } = theme.useToken();
  const stepIdx = pipelineStepIndex(state.status);
  const isError = state.status === "error";
  const isDup = state.status === "duplicate";
  const isSuccess = state.status === "success";
  const isWorking = ["hashing", "uploading", "processing", "embedding"].includes(state.status);

  const statusColor = isError
    ? token.colorError
    : isDup
    ? token.colorWarning
    : isSuccess
    ? token.colorSuccess
    : token.colorPrimary;

  return (
    <Card
      size="small"
      style={{
        borderLeft: `3px solid ${statusColor}`,
      }}
      styles={{ body: { padding: 12 } }}
    >
      <Row gutter={12} align="middle">
        <Col flex="auto">
          <Space vertical size={6} style={{ width: "100%" }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Space size={8}>
                <FileTextOutlined style={{ color: statusColor }} />
                <Text strong style={{ fontSize: 13 }}>{state.file.name}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {(state.file.size / 1024 / 1024).toFixed(2)} MB
                </Text>
              </Space>
              <Space size={6}>
                {state.chunkCount !== undefined && (
                  <Tag style={{ fontSize: 10, margin: 0 }}>{state.chunkCount.toLocaleString("es")} chunks</Tag>
                )}
                {isSuccess && state.documentId && (
                  <Link href={`/documents/${state.documentId}`}>
                    <Button size="small" type="link" icon={<EyeOutlined />}>
                      Abrir
                    </Button>
                  </Link>
                )}
                {isError && (
                  <Button size="small" icon={<ReloadOutlined />} onClick={onRetry} disabled={disabled}>
                    Reintentar
                  </Button>
                )}
                {!isWorking && (
                  <Button size="small" type="text" icon={<CloseCircleOutlined />} onClick={onRemove} />
                )}
              </Space>
            </Space>
            <Text style={{ fontSize: 12, color: statusColor }}>
              {isWorking && <LoadingOutlined style={{ marginRight: 6 }} />}
              {state.message}
            </Text>
            {state.status === "embedding" && state.embeddingProgress && (
              <Progress
                percent={Math.round(
                  (state.embeddingProgress.processed / Math.max(1, state.embeddingProgress.total)) * 100,
                )}
                size="small"
                showInfo={false}
                strokeColor={token.colorPrimary}
              />
            )}
            {!isError && !isDup && (
              <Steps
                current={stepIdx}
                size="small"
                items={PIPELINE_STEPS.map((p, i) => ({
                  title: p.title,
                  status:
                    isSuccess && i <= stepIdx
                      ? "finish"
                      : i < stepIdx
                      ? "finish"
                      : i === stepIdx
                      ? isWorking
                        ? "process"
                        : isSuccess
                        ? "finish"
                        : "wait"
                      : "wait",
                }))}
                style={{ marginTop: 8 }}
              />
            )}
          </Space>
        </Col>
      </Row>
    </Card>
  );
}
