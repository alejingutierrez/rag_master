/**
 * Smoke test pre/post deploy.
 *
 *   --suite=chat (default)  → POST /api/chat → polling → COMPLETE con chunks+answer
 *   --suite=atelier         → POST /api/atelier → polling → COMPLETE limpio + confianza
 *   --suite=all             → ambas
 *
 * Uso:
 *   npx tsx scripts/smoke-test.mts                          # suite chat, localhost
 *   npx tsx scripts/smoke-test.mts --target=https://… --suite=all
 *   npx tsx scripts/smoke-test.mts --suite=atelier --atelierTimeout=900
 *
 * NOTA: el Taller tarda ~6-9 min; su suite usa un deadline amplio (default 900s).
 * El gate de CI por defecto sigue siendo `chat` para no ralentizarlo.
 *
 * Exit 0 si todo OK, exit 1 si cualquier paso falla.
 */

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, ...rest] = a.replace(/^--/, "").split("=");
      return [k, rest.join("=") || "true"];
    })
);

const TARGET = (args.target as string) || "http://localhost:3000";
const SUITE = (args.suite as string) || "chat"; // chat | atelier | all
const QUESTION =
  (args.question as string) ||
  "¿Qué pasó en el Palacio de Justicia en noviembre de 1985?";
const ATELIER_INTENT =
  (args.intent as string) ||
  "Cuéntame el bipartidismo colombiano y la consolidación del poder entre 1886 y 1957.";
const ATELIER_FORMAT = (args.format as string) || "cronica";
const POST_DEADLINE_MS = 5_000;
const TOTAL_DEADLINE_MS = Number(args.timeout || "90") * 1_000;
const ATELIER_DEADLINE_MS = Number(args.atelierTimeout || "900") * 1_000;
const POLL_INTERVAL_MS = 2_000;

// El candado del middleware gatea /api/*; el smoke se autentica con el token.
const ADMIN_TOKEN = process.env.ADMIN_ACCESS_TOKEN;
const AUTH: Record<string, string> = ADMIN_TOKEN
  ? { Authorization: `Bearer ${ADMIN_TOKEN}` }
  : {};

interface PostResponse {
  id?: string;
  deliverableId?: string;
  error?: string;
}

function log(step: string, msg: string): void {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] ${step.padEnd(8)} ${msg}`);
}

function fail(msg: string): never {
  console.error(`\nFAIL: ${msg}`);
  process.exit(1);
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p;
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`Timeout ${label} (${ms}ms)`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ── Suite: /api/chat/stream (Consultar — SSE en vivo) ────────────────
// Consultar streamea: POST devuelve un text/event-stream con eventos
// meta / chunks / delta / done. Validamos que lleguen pasajes y respuesta.
async function smokeChat(): Promise<void> {
  log("CHAT", `target=${TARGET}`);
  log("CHAT", `question="${QUESTION}"`);

  const postStart = Date.now();
  let res: Response;
  try {
    res = await withTimeout(
      fetch(`${TARGET}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH },
        body: JSON.stringify({ question: QUESTION }),
      }),
      TOTAL_DEADLINE_MS,
      "POST /api/chat/stream"
    );
  } catch (e) {
    fail(`POST /api/chat/stream — ${(e as Error).message}`);
  }
  log("POST", `${res.status} en ${Date.now() - postStart}ms`);
  if (!res.ok || !res.body) {
    fail(`POST status ${res.status} — ${(await res.text().catch(() => "")).slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let answer = "";
  let chunkCount = 0;
  let done = false;
  const deadlineAt = Date.now() + TOTAL_DEADLINE_MS;

  while (Date.now() < deadlineAt) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const ev of events) {
      for (const line of ev.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        let d: { type?: string; chunks?: unknown[]; text?: string; message?: string };
        try {
          d = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        if (d.type === "chunks") {
          chunkCount = (d.chunks ?? []).length;
          log("SSE", `chunks=${chunkCount}`);
        } else if (d.type === "delta") {
          answer += d.text ?? "";
        } else if (d.type === "done") {
          done = true;
        } else if (d.type === "error") {
          fail(`stream error: ${d.message ?? "(sin mensaje)"}`);
        }
      }
    }
    if (done) break;
  }

  if (!done) fail(`stream no emitió 'done' (chunks=${chunkCount}, answer.len=${answer.length})`);
  if (chunkCount === 0) fail("stream terminó sin pasajes (chunks=0)");
  if (answer.length < 100) fail(`answer demasiado corto (${answer.length} chars)`);
  log("CHAT", `OK chunks=${chunkCount} answer.len=${answer.length}`);
}

// ── Suite: /api/atelier ──────────────────────────────────────────────
interface AtelierPoll {
  status?: string;
  answer?: string;
  chunksUsed?: unknown[];
  metadata?: { atelier?: { stage?: string; confidenceIndex?: { score?: number } } } | null;
}

async function smokeAtelier(): Promise<void> {
  log("ATELIER", `target=${TARGET} · formato=${ATELIER_FORMAT}`);
  log("ATELIER", `intent="${ATELIER_INTENT}"`);

  const postStart = Date.now();
  let postRes: Response;
  try {
    postRes = await withTimeout(
      fetch(`${TARGET}/api/atelier`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...AUTH },
        body: JSON.stringify({ intent: ATELIER_INTENT, formatId: ATELIER_FORMAT }),
      }),
      POST_DEADLINE_MS,
      "POST /api/atelier"
    );
  } catch (e) {
    fail(`POST /api/atelier — ${(e as Error).message}`);
  }
  log("POST", `${postRes.status} en ${Date.now() - postStart}ms`);
  if (!postRes.ok) fail(`POST status ${postRes.status} — ${(await postRes.text()).slice(0, 300)}`);

  const post = (await postRes.json()) as PostResponse;
  const id = post.deliverableId ?? post.id;
  if (post.error) fail(`POST devolvió error: ${post.error}`);
  if (!id) fail("POST no devolvió deliverableId");
  log("POST", `deliverableId=${id}`);

  const deadlineAt = Date.now() + ATELIER_DEADLINE_MS;
  let lastStage = "";
  while (Date.now() < deadlineAt) {
    await new Promise((r) => setTimeout(r, 5_000));
    let pollRes: Response;
    try {
      pollRes = await withTimeout(
        fetch(`${TARGET}/api/deliverables/${id}`, { headers: AUTH }),
        10_000,
        "GET /api/deliverables/[id]"
      );
    } catch (e) {
      log("POLL", `error: ${(e as Error).message} — reintentando`);
      continue;
    }
    if (!pollRes.ok) {
      log("POLL", `status ${pollRes.status} — reintentando`);
      continue;
    }
    const data = (await pollRes.json()) as AtelierPoll;
    const stage = data.metadata?.atelier?.stage ?? "";
    if (stage !== lastStage) {
      lastStage = stage;
      log("POLL", `status=${data.status} stage=${stage}`);
    }
    if (data.status === "COMPLETE") {
      const answer = data.answer ?? "";
      const chunks = data.chunksUsed ?? [];
      const ci = data.metadata?.atelier?.confidenceIndex;
      if (answer.length < 100) fail(`answer demasiado corto (${answer.length} chars)`);
      if (/\[#?\d+\]/.test(answer)) fail("el cuerpo contiene citas inline");
      if (chunks.length === 0) fail("COMPLETE sin chunksUsed");
      if (!ci || typeof ci.score !== "number") fail("falta metadata.atelier.confidenceIndex");
      log("ATELIER", `OK answer.len=${answer.length} chunks=${chunks.length} confianza=${ci.score}`);
      return;
    }
    if (data.status === "ERROR") fail(`atelier status=ERROR: ${data.answer || "(sin mensaje)"}`);
  }
  fail(`Timeout atelier ${ATELIER_DEADLINE_MS}ms (último stage=${lastStage})`);
}

async function main(): Promise<void> {
  log("START", `suite=${SUITE}`);
  const start = Date.now();
  if (SUITE === "chat" || SUITE === "all") await smokeChat();
  if (SUITE === "atelier" || SUITE === "all") await smokeAtelier();
  console.log(`\nOK — smoke (${SUITE}) pasado en ${Date.now() - start}ms`);
}

main().catch((e) => fail((e as Error).message));
