"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  Typography,
  Space,
  Tag,
  Button,
  Input,
  theme,
  App,
  Row,
  Col,
  Empty,
  Tabs,
  Modal,
  Select,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  FileTextOutlined,
  BookOutlined,
  AppstoreOutlined,
  SaveOutlined,
  EditOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Workspace {
  id: string;
  name: string;
  description?: string;
  pinned: { documents: string[]; questions: string[]; productions: string[] };
  notes: string;
  createdAt: string;
  updatedAt: string;
}

import { safeGet, safeSet } from "@/lib/safe-storage";

const STORAGE_KEY = "rag-master-workspaces";

function loadWS(): Workspace[] {
  return safeGet<Workspace[]>(STORAGE_KEY, []);
}
function saveWS(w: Workspace[]) {
  return safeSet(STORAGE_KEY, w);
}

export default function WorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [docs, setDocs] = useState<Array<{ id: string; filename: string }>>([]);
  const [questions, setQuestions] = useState<Array<{ id: string; pregunta: string }>>([]);
  const [productions, setProductions] = useState<Array<{ id: string; templateId: string; userQuestion?: string; question?: { pregunta: string } }>>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [showAdd, setShowAdd] = useState<"documents" | "questions" | "productions" | null>(null);

  useEffect(() => {
    const all = loadWS();
    const found = all.find((w) => w.id === id) ?? null;
    setWs(found);
    setNotesDraft(found?.notes ?? "");
  }, [id]);

  useEffect(() => {
    Promise.all([
      fetch("/api/documents?limit=300").then((r) => r.json()).then((d) => setDocs(d.documents ?? [])),
      fetch("/api/questions?limit=300").then((r) => r.json()).then((d) => setQuestions(d.questions ?? [])),
      fetch("/api/deliverables?limit=100").then((r) => r.json()).then((d) => setProductions(d.deliverables ?? [])),
    ]).catch(console.error);
  }, []);

  if (!ws) return <div className="app-page"><Empty description="Workspace no encontrado" /></div>;

  const persist = (updated: Workspace) => {
    const next = { ...updated, updatedAt: new Date().toISOString() };
    setWs(next);
    const all = loadWS().map((w) => (w.id === id ? next : w));
    saveWS(all);
  };

  const togglePin = (kind: "documents" | "questions" | "productions", refId: string) => {
    const arr = ws.pinned[kind];
    const next = arr.includes(refId) ? arr.filter((x) => x !== refId) : [...arr, refId];
    persist({ ...ws, pinned: { ...ws.pinned, [kind]: next } });
  };

  const saveNotes = () => {
    persist({ ...ws, notes: notesDraft });
    setEditingNotes(false);
    message.success("Notas guardadas");
  };

  const pinnedDocs = docs.filter((d) => ws.pinned.documents.includes(d.id));
  const pinnedQs = questions.filter((q) => ws.pinned.questions.includes(q.id));
  const pinnedProds = productions.filter((p) => ws.pinned.productions.includes(p.id));

  return (
    <div className="app-page">
      <Link href="/workspaces">
        <Button type="text" icon={<ArrowLeftOutlined />} style={{ marginBottom: 12 }}>
          Volver a workspaces
        </Button>
      </Link>

      <Title level={2} className="serif-title" style={{ margin: 0 }}>{ws.name}</Title>
      {ws.description && <Paragraph style={{ color: token.colorTextSecondary, margin: "6px 0 0" }}>{ws.description}</Paragraph>}

      <Tabs
        defaultActiveKey="docs"
        style={{ marginTop: 16 }}
        items={[
          {
            key: "docs",
            label: <><FileTextOutlined /> Documentos ({pinnedDocs.length})</>,
            children: (
              <>
                <Button icon={<PlusOutlined />} onClick={() => setShowAdd("documents")} style={{ marginBottom: 12 }}>
                  Anclar documentos
                </Button>
                {pinnedDocs.length === 0 ? (
                  <Empty description="Sin documentos anclados" />
                ) : (
                  <Space vertical size={8} style={{ width: "100%" }}>
                    {pinnedDocs.map((d) => (
                      <Card key={d.id} size="small">
                        <Space style={{ justifyContent: "space-between", width: "100%" }}>
                          <Link href={`/documents/${d.id}`}>
                            <Space><FileTextOutlined /><Text>{d.filename}</Text></Space>
                          </Link>
                          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => togglePin("documents", d.id)} />
                        </Space>
                      </Card>
                    ))}
                  </Space>
                )}
              </>
            ),
          },
          {
            key: "qs",
            label: <><BookOutlined /> Preguntas ({pinnedQs.length})</>,
            children: (
              <>
                <Button icon={<PlusOutlined />} onClick={() => setShowAdd("questions")} style={{ marginBottom: 12 }}>
                  Anclar preguntas
                </Button>
                {pinnedQs.length === 0 ? (
                  <Empty description="Sin preguntas ancladas" />
                ) : (
                  <Space vertical size={8} style={{ width: "100%" }}>
                    {pinnedQs.map((q) => (
                      <Card key={q.id} size="small">
                        <Space style={{ justifyContent: "space-between", width: "100%" }}>
                          <Text style={{ flex: 1, fontFamily: "var(--font-serif)" }}>{q.pregunta}</Text>
                          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => togglePin("questions", q.id)} />
                        </Space>
                      </Card>
                    ))}
                  </Space>
                )}
              </>
            ),
          },
          {
            key: "prods",
            label: <><AppstoreOutlined /> Producciones ({pinnedProds.length})</>,
            children: (
              <>
                <Button icon={<PlusOutlined />} onClick={() => setShowAdd("productions")} style={{ marginBottom: 12 }}>
                  Anclar producciones
                </Button>
                {pinnedProds.length === 0 ? (
                  <Empty description="Sin producciones ancladas" />
                ) : (
                  <Space vertical size={8} style={{ width: "100%" }}>
                    {pinnedProds.map((p) => (
                      <Card key={p.id} size="small">
                        <Space style={{ justifyContent: "space-between", width: "100%" }}>
                          <Link href={`/producciones/${p.id}`}>
                            <Text>{p.question?.pregunta ?? p.userQuestion ?? "(producción)"}</Text>
                          </Link>
                          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => togglePin("productions", p.id)} />
                        </Space>
                      </Card>
                    ))}
                  </Space>
                )}
              </>
            ),
          },
          {
            key: "notes",
            label: <><EditOutlined /> Notas</>,
            children: (
              <Card
                extra={
                  editingNotes ? (
                    <Space>
                      <Button onClick={() => { setEditingNotes(false); setNotesDraft(ws.notes); }}>Cancelar</Button>
                      <Button type="primary" icon={<SaveOutlined />} onClick={saveNotes}>Guardar</Button>
                    </Space>
                  ) : (
                    <Button icon={<EditOutlined />} onClick={() => setEditingNotes(true)}>Editar</Button>
                  )
                }
              >
                {editingNotes ? (
                  <TextArea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={16}
                    placeholder="Notas en Markdown sobre este workspace…"
                  />
                ) : ws.notes ? (
                  <div className="prose-academic" style={{ fontSize: 14 }}>
                    <ReactMarkdown>{ws.notes}</ReactMarkdown>
                  </div>
                ) : (
                  <Empty description="Sin notas — haz click en Editar" />
                )}
              </Card>
            ),
          },
        ]}
      />

      <PinModal
        show={showAdd}
        onClose={() => setShowAdd(null)}
        onPin={(refId) => {
          if (showAdd) togglePin(showAdd, refId);
        }}
        docs={docs}
        questions={questions}
        productions={productions}
        ws={ws}
      />
    </div>
  );
}

function PinModal({
  show,
  onClose,
  onPin,
  docs,
  questions,
  productions,
  ws,
}: {
  show: "documents" | "questions" | "productions" | null;
  onClose: () => void;
  onPin: (id: string) => void;
  docs: Array<{ id: string; filename: string }>;
  questions: Array<{ id: string; pregunta: string }>;
  productions: Array<{ id: string; templateId: string; question?: { pregunta: string }; userQuestion?: string }>;
  ws: Workspace;
}) {
  const [selected, setSelected] = useState<string | undefined>();
  if (!show) return null;
  const options =
    show === "documents"
      ? docs.filter((d) => !ws.pinned.documents.includes(d.id)).map((d) => ({ value: d.id, label: d.filename }))
      : show === "questions"
      ? questions.filter((q) => !ws.pinned.questions.includes(q.id)).map((q) => ({ value: q.id, label: q.pregunta.slice(0, 100) }))
      : productions.filter((p) => !ws.pinned.productions.includes(p.id)).map((p) => ({
          value: p.id,
          label: (p.question?.pregunta ?? p.userQuestion ?? "(producción)").slice(0, 100),
        }));

  return (
    <Modal
      open={!!show}
      title={`Anclar ${show === "documents" ? "documento" : show === "questions" ? "pregunta" : "producción"}`}
      onCancel={onClose}
      okText="Anclar"
      onOk={() => {
        if (selected) {
          onPin(selected);
          setSelected(undefined);
        }
        onClose();
      }}
    >
      <Select
        showSearch
        optionFilterProp="label"
        style={{ width: "100%" }}
        value={selected}
        onChange={setSelected}
        options={options}
        placeholder="Buscar…"
      />
    </Modal>
  );
}
