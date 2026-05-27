/**
 * Smoke test pre/post deploy contra el endpoint /api/chat.
 *
 * Valida que el flujo crítico del producto funciona:
 *   1. POST /api/chat responde en <5s con un id.
 *   2. Polling de /api/chat/[id] alcanza status=COMPLETE en <90s.
 *   3. La respuesta tiene chunks (≥1) y answer (≥100 chars).
 *
 * Uso:
 *   npx tsx scripts/smoke-test.mts                    # default: http://localhost:3000
 *   npx tsx scripts/smoke-test.mts --target=https://fbrwkqtydz.us-east-1.awsapprunner.com
 *   npx tsx scripts/smoke-test.mts --question="..." --timeout=120
 *
 * Exit 0 si todo OK, exit 1 si cualquier paso falla. Integrar en CI/CD
 * para detectar regresiones antes de promover el deploy a prod.
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
const QUESTION =
  (args.question as string) ||
  "¿Qué pasó en el Palacio de Justicia en noviembre de 1985?";
const POST_DEADLINE_MS = 5_000;
const TOTAL_DEADLINE_MS = Number(args.timeout || "90") * 1_000;
const POLL_INTERVAL_MS = 2_000;

interface PostResponse {
  id?: string;
  deliverableId?: string;
  error?: string;
}

interface PollResponse {
  status?: "RETRIEVING" | "GENERATING" | "COMPLETE" | "ERROR";
  answer?: string;
  chunks?: unknown[];
  isDone?: boolean;
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

async function main(): Promise<void> {
  log("START", `target=${TARGET}`);
  log("START", `question="${QUESTION}"`);

  // 1. POST con deadline duro
  const postStart = Date.now();
  let postRes: Response;
  try {
    postRes = await withTimeout(
      fetch(`${TARGET}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: QUESTION }),
      }),
      POST_DEADLINE_MS,
      "POST /api/chat"
    );
  } catch (e) {
    fail(`POST /api/chat — ${(e as Error).message}`);
  }
  const postMs = Date.now() - postStart;
  log("POST", `${postRes.status} en ${postMs}ms`);

  if (!postRes.ok) {
    const body = await postRes.text();
    fail(`POST status ${postRes.status} — ${body.slice(0, 300)}`);
  }

  const { id, error } = (await postRes.json()) as PostResponse;
  if (error) fail(`POST devolvió error: ${error}`);
  if (!id) fail("POST no devolvió id");
  log("POST", `id=${id}`);

  // 2. Polling hasta COMPLETE / ERROR
  const deadlineAt = Date.now() + TOTAL_DEADLINE_MS;
  let lastStatus = "";
  let chunksLogged = false;
  while (Date.now() < deadlineAt) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    let pollRes: Response;
    try {
      pollRes = await withTimeout(
        fetch(`${TARGET}/api/chat/${id}`),
        10_000,
        "GET /api/chat/[id]"
      );
    } catch (e) {
      log("POLL", `error: ${(e as Error).message} — reintentando`);
      continue;
    }
    if (!pollRes.ok) {
      log("POLL", `status ${pollRes.status} — reintentando`);
      continue;
    }

    const data = (await pollRes.json()) as PollResponse;
    if (data.status !== lastStatus) {
      lastStatus = data.status || "";
      log("POLL", `status=${data.status} chunks=${data.chunks?.length ?? 0}`);
    }

    if (!chunksLogged && (data.chunks?.length ?? 0) > 0) {
      chunksLogged = true;
      log("POLL", `primer batch de chunks: ${data.chunks!.length}`);
    }

    if (data.status === "COMPLETE") {
      const chunks = data.chunks ?? [];
      const answer = data.answer ?? "";
      if (chunks.length === 0) fail(`COMPLETE sin chunks`);
      if (answer.length < 100) fail(`answer demasiado corto (${answer.length} chars)`);
      const totalMs = Date.now() - postStart;
      log("DONE", `chunks=${chunks.length} answer.len=${answer.length} total=${totalMs}ms`);
      console.log(`\nOK — smoke test pasado en ${totalMs}ms`);
      return;
    }

    if (data.status === "ERROR") {
      fail(`status=ERROR: ${data.answer || data.error || "(sin mensaje)"}`);
    }
  }

  fail(`Timeout total ${TOTAL_DEADLINE_MS}ms sin alcanzar COMPLETE (último status=${lastStatus})`);
}

main().catch((e) => fail((e as Error).message));
