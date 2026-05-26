/**
 * Smoke test del rediseño "Archivo Vivo v2".
 *
 * Verifica que las 18 rutas del nuevo diseño respondan 200 y contengan
 * el `data-screen-label` esperado. Diseñado para correr contra el dev server.
 *
 * Uso:
 *   PORT=3000 npx tsx tests/smoke-archivo-vivo.mts
 *
 * El test no necesita Playwright — usa fetch y verifica HTML.
 */

const PORT = process.env.PORT ?? "3000";
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`;

interface RouteCheck {
  path: string;
  label: string;
  /** Texto que debe aparecer en el HTML (no se chequea si vacío). */
  contains?: string;
}

const ROUTES: RouteCheck[] = [
  { path: "/", label: "Dashboard", contains: "Una historia de Colombia" },
  { path: "/chat", label: "Chat", contains: "Consultar" },
  { path: "/timeline", label: "Timeline", contains: "Quinientos años" },
  { path: "/documents", label: "Documents", contains: "Documentos" },
  { path: "/upload", label: "Upload", contains: "Cargar" },
  { path: "/enrich", label: "Enrich", contains: "Enriquecer" },
  { path: "/questions", label: "Questions", contains: "Preguntas" },
  { path: "/questions/matriz", label: "QuestionsMatriz", contains: "Matriz Q×T" },
  { path: "/questions/generate", label: "QuestionsGenerate", contains: "Generar" },
  { path: "/hypothesis", label: "Hypothesis", contains: "Hipótesis" },
  { path: "/deep-research", label: "DeepResearch", contains: "Deep Research" },
  { path: "/compare", label: "Compare", contains: "Comparador" },
  { path: "/producciones", label: "Producciones", contains: "Producciones" },
  { path: "/bibliography", label: "Bibliography", contains: "Bibliografía" },
  { path: "/threads", label: "Threads", contains: "Hilos" },
  { path: "/workspaces", label: "Workspaces", contains: "Workspaces" },
  { path: "/entities", label: "Entities", contains: "Entidades" },
  { path: "/graph", label: "Graph", contains: "Grafo" },
];

interface Result {
  path: string;
  status: number;
  hasLabel: boolean;
  hasText: boolean;
  ok: boolean;
  error?: string;
}

async function checkRoute(r: RouteCheck): Promise<Result> {
  try {
    const res = await fetch(`${BASE}${r.path}`);
    const html = await res.text();
    const hasLabel = html.includes(`data-screen-label="${r.label}"`);
    const hasText = r.contains ? html.includes(r.contains) : true;
    return {
      path: r.path,
      status: res.status,
      hasLabel,
      hasText,
      ok: res.ok && hasLabel && hasText,
    };
  } catch (err) {
    return {
      path: r.path,
      status: 0,
      hasLabel: false,
      hasText: false,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  console.log(`🧪 Smoke test — Archivo Vivo v2`);
  console.log(`   Base: ${BASE}`);
  console.log(`   Rutas: ${ROUTES.length}\n`);

  const results = await Promise.all(ROUTES.map(checkRoute));

  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const icon = r.ok ? "✓" : "✗";
    const dot = r.ok ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    const labelFlag = r.hasLabel ? "" : " [missing screen-label]";
    const textFlag = r.hasText ? "" : " [missing text]";
    const errFlag = r.error ? ` (${r.error})` : "";
    console.log(
      `${dot}${icon}${reset} ${r.status} ${r.path}${labelFlag}${textFlag}${errFlag}`,
    );
    if (r.ok) passed++;
    else failed++;
  }

  console.log(`\n${passed}/${results.length} pasaron`);
  if (failed > 0) {
    console.error(`\n${failed} fallaron`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
