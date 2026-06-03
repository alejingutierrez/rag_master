/**
 * Tests unitarios de las funciones puras del Taller (sin red ni DB).
 *   npx tsx scripts/test-atelier-units.mts   ·   npm run test:atelier
 * Exit 0 si todo pasa, 1 si algo falla.
 */
import assert from "node:assert";
import { rebalanceByDiversity, countUniqueDocuments } from "../src/lib/atelier/diversity";
import { extractJsonObject, parseJsonObject } from "../src/lib/atelier/json";
import {
  deriveConfidenceIndex,
  buildCriticalApparatus,
  stripScaffolding,
} from "../src/lib/atelier/aparato";
import { normalizeTaxonomy, reconcilePeriodo } from "../src/lib/taxonomy";
import type { SearchResult } from "../src/lib/vector-search";
import type { VerifiedClaim } from "../src/lib/atelier/types";

let pass = 0;
let fail = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`);
    fail++;
  }
}
function group(name: string): void {
  console.log(`\n${name}`);
}

// ── Fixtures ─────────────────────────────────────────────────────────
function chunk(id: string, doc: string, sim = 0.8): SearchResult {
  return {
    id,
    documentId: doc,
    documentFilename: `${doc}.pdf`,
    content: `contenido de ${id}`,
    pageNumber: 1,
    chunkIndex: 0,
    similarity: sim,
    metadata: {},
  };
}
function vclaim(
  id: string,
  docs: string[],
  conf: number,
  contra = false,
  nucleo = "Núcleo A"
): VerifiedClaim {
  return {
    id,
    nucleo,
    texto: `afirmación ${id}`,
    concordancia: contra ? "contradicha" : docs.length >= 2 ? "fuerte" : "unica",
    veredicto: "soportado",
    confianza: conf,
    fuentes: docs.map((d, i) => ({
      chunkId: `${id}-${i}`,
      documentId: d,
      documentFilename: `${d}.pdf`,
      pageNumber: 1,
    })),
    ...(contra
      ? { contradiccion: { conflicto: "x", versionElegida: "y", razon: "z" } }
      : {}),
  };
}

// ── 1. Diversidad de fuentes ─────────────────────────────────────────
group("rebalanceByDiversity / countUniqueDocuments");

test("10 fragmentos de 1 doc → 1 doc único, recortado al cap por doc", () => {
  const chunks = Array.from({ length: 10 }, (_, i) => chunk(`c${i}`, "docA"));
  const r = rebalanceByDiversity(chunks, { targetSize: 80, capPerDoc: 6 });
  assert.equal(countUniqueDocuments(r), 1);
  assert.equal(r.length, 6);
});

test("10 fragmentos de 7 docs → 7 docs únicos", () => {
  const docs = ["a", "b", "c", "d", "e", "f", "g", "a", "b", "c"];
  const chunks = docs.map((d, i) => chunk(`c${i}`, `doc${d}`));
  const r = rebalanceByDiversity(chunks, { targetSize: 80, capPerDoc: 6 });
  assert.equal(countUniqueDocuments(r), 7);
});

test("round-robin: el #1 de cada doc entra antes que el #2 del dominante", () => {
  const chunks = [chunk("a0", "A"), chunk("a1", "A"), chunk("a2", "A"), chunk("b0", "B")];
  const r = rebalanceByDiversity(chunks, { targetSize: 80, capPerDoc: 6 });
  assert.equal(r[0].id, "a0");
  assert.equal(r[1].id, "b0"); // B antes que el segundo de A
  assert.equal(r[2].id, "a1");
});

test("entrada vacía → [] sin lanzar", () => {
  assert.deepEqual(rebalanceByDiversity([]), []);
  assert.equal(countUniqueDocuments([]), 0);
});

test("targetSize corta el resultado", () => {
  const chunks = Array.from({ length: 20 }, (_, i) => chunk(`c${i}`, `doc${i}`));
  const r = rebalanceByDiversity(chunks, { targetSize: 5, capPerDoc: 6 });
  assert.equal(r.length, 5);
});

// ── 2. Parseo de JSON del dossier ────────────────────────────────────
group("extractJsonObject / parseJsonObject");

test("JSON envuelto en prosa", () => {
  const t = 'Claro, aquí tienes:\n{"a":1,"b":[1,2]}\nEso es todo.';
  assert.deepEqual(JSON.parse(extractJsonObject(t)), { a: 1, b: [1, 2] });
});

test("bloque ```json cercado", () => {
  const t = '```json\n{"x": "y"}\n```';
  assert.deepEqual(JSON.parse(extractJsonObject(t)), { x: "y" });
});

test("llaves dentro de strings no rompen el balance", () => {
  const t = '{"texto":"esto tiene { llaves } adentro","n":2}';
  assert.deepEqual(JSON.parse(extractJsonObject(t)), {
    texto: "esto tiene { llaves } adentro",
    n: 2,
  });
});

test("sin objeto JSON → lanza", () => {
  assert.throws(() => extractJsonObject("no hay json aquí"));
});

test("JSON no balanceado → lanza", () => {
  assert.throws(() => parseJsonObject("{ roto: "));
});

test("balanceado pero inválido → lanza", () => {
  assert.throws(() => parseJsonObject('{"a": }'));
});

// ── 3. Índice de confianza ───────────────────────────────────────────
group("deriveConfidenceIndex");

test("alta diversidad + corroboración + 0 contradicciones → alta", () => {
  const claims = Array.from({ length: 8 }, (_, i) =>
    vclaim(`c${i}`, [`d${i}`, `d${(i + 1) % 8}`], 0.9)
  );
  const ci = deriveConfidenceIndex(claims);
  assert.equal(ci.label, "alta");
  assert.ok(ci.score >= 70 && ci.score <= 100, `score=${ci.score}`);
  assert.equal(ci.contradiccionesResueltas, 0);
});

test("un solo documento → baja", () => {
  const claims = Array.from({ length: 5 }, (_, i) => vclaim(`c${i}`, ["solo"], 0.6));
  const ci = deriveConfidenceIndex(claims);
  assert.equal(ci.documentosUnicos, 1);
  assert.equal(ci.label, "baja");
});

test("más contradicciones ⇒ score estrictamente menor (monótono)", () => {
  const build = (nContra: number) =>
    Array.from({ length: 8 }, (_, i) =>
      vclaim(`c${i}`, [`d${i}`, `d${(i + 1) % 8}`], 0.9, i < nContra)
    );
  const s0 = deriveConfidenceIndex(build(0)).score;
  const s4 = deriveConfidenceIndex(build(4)).score;
  const s8 = deriveConfidenceIndex(build(8)).score;
  assert.ok(s0 > s4 && s4 > s8, `esperado s0>s4>s8, got ${s0},${s4},${s8}`);
});

test("score siempre en [0,100], incluso con entrada vacía", () => {
  const ci = deriveConfidenceIndex([]);
  assert.ok(ci.score >= 0 && ci.score <= 100, `score=${ci.score}`);
  assert.equal(ci.claimsTotales, 0);
});

// ── 4. Aparato crítico ───────────────────────────────────────────────
group("buildCriticalApparatus");

test("agrupa por núcleo, deduplica fuentes y no deja refs colgantes", () => {
  const c1 = vclaim("c1", ["d1", "d2"], 0.8, false, "Núcleo A");
  // c2 reusa una fuente de c1 (mismo chunkId) para probar dedupe:
  const c2: VerifiedClaim = {
    ...vclaim("c2", ["d1"], 0.7, false, "Núcleo A"),
    fuentes: [{ chunkId: "c1-0", documentId: "d1", documentFilename: "d1.pdf", pageNumber: 1 }],
  };
  const c3 = vclaim("c3", ["d3"], 0.6, false, "Núcleo B");
  const ap = buildCriticalApparatus([c1, c2, c3]);

  assert.equal(ap.fuentesPorSeccion.length, 2);
  const secA = ap.fuentesPorSeccion.find((s) => s.seccion === "Núcleo A")!;
  assert.equal(secA.sourceRefs.length, 2); // c1-0 (compartido) + c1-1
  assert.deepEqual(secA.claimIds, ["c1", "c2"]);

  const known = new Set([c1, c2, c3].flatMap((c) => c.fuentes.map((f) => f.chunkId)));
  for (const s of ap.fuentesPorSeccion)
    for (const r of s.sourceRefs) assert.ok(known.has(r.chunkId), `ref colgante ${r.chunkId}`);

  assert.ok(/Referencias/i.test(ap.bibliografia));
});

test("claims vacíos → secciones vacías sin lanzar", () => {
  const ap = buildCriticalApparatus([]);
  assert.deepEqual(ap.fuentesPorSeccion, []);
});

// ── 5. Sanitizador del cuerpo ────────────────────────────────────────
group("stripScaffolding");

test("elimina citas inline [#N] y [N], conserva el dato", () => {
  const out = stripScaffolding("El hecho ocurrió en 1948 [#3] y se repitió [12].");
  assert.ok(!out.includes("[#"));
  assert.ok(!/\[\d+\]/.test(out));
  assert.ok(out.includes("1948"));
});

test("elimina (p. 23) y (pp. 10-12)", () => {
  const out = stripScaffolding("Según el relato (p. 23), la cifra subió (pp. 10-12).");
  assert.ok(!/\(p{1,2}\.?\s*\d+/i.test(out));
});

test("purga una sección de Referencias al final", () => {
  const out = stripScaffolding(
    "Cuerpo limpio del ensayo.\n\n## Referencias\n\nAutor (2020). *Obra*."
  );
  assert.ok(!/##\s+Referencias/i.test(out));
  assert.ok(out.includes("Cuerpo limpio"));
});

test("un cuerpo ya limpio se mantiene", () => {
  const body = "# Título\n\nUn párrafo normal sin nada raro.";
  const out = stripScaffolding(body);
  assert.ok(out.includes("# Título"));
  assert.ok(out.includes("párrafo normal"));
});

// ── 6. Taxonomía de entregables ──────────────────────────────────────
group("reconcilePeriodo / normalizeTaxonomy");

test("reconcilePeriodo: código válido y año coherente → mismo", () => {
  assert.equal(reconcilePeriodo("REG", 1900), "REG");
});
test("reconcilePeriodo: año fuera de rango → recalcula desde el año", () => {
  assert.equal(reconcilePeriodo("REG", 1700), "COL");
});
test("reconcilePeriodo: código inválido con año → período del año", () => {
  assert.equal(reconcilePeriodo("ZZZ", 1985), "CNA");
});
test("reconcilePeriodo: código inválido sin año → TRANS", () => {
  assert.equal(reconcilePeriodo("", null), "TRANS");
});
test("reconcilePeriodo: TRANS se respeta", () => {
  assert.equal(reconcilePeriodo("TRANS", 1850), "TRANS");
});

test("normalizeTaxonomy: completo en camelCase", () => {
  const t = normalizeTaxonomy({
    periodoCode: "REG",
    categoriaCode: "POL",
    subcategoriaNombre: "Formación del Estado",
    yearPrincipal: 1900,
    yearsSecondary: [1886, 1910],
    periodosRelacionados: ["EUC", "REG"],
    entidades: { personas: ["Rafael Núñez"], lugares: ["Bogotá"], conceptos: ["Regeneración"] },
    tipoPregunta: "causal",
    clusterTematico: "hegemonía conservadora",
    escalaGeografica: "nacional",
  });
  assert.equal(t.periodoCode, "REG");
  assert.equal(t.periodoNombre, "Regeneración y Hegemonía Conservadora");
  assert.equal(t.categoriaCode, "POL");
  assert.equal(t.categoriaNombre, "Política y Estado");
  assert.deepEqual(t.entidadesPersonas, ["Rafael Núñez"]);
  assert.equal(t.tipoPregunta, "causal");
  assert.equal(t.escalaGeografica, "nacional");
  assert.deepEqual(t.periodosRelacionados, ["EUC"]); // se filtra el propio REG
});

test("normalizeTaxonomy: snake_case, año string y entidades planas", () => {
  const t = normalizeTaxonomy({
    periodo_code: "vio",
    categoria_code: "con",
    anio_principal: "1950",
    anios_secundarios: ["1948"],
    entidadesPersonas: ["Jorge Eliécer Gaitán"],
    tipo_pregunta: "Causal",
    escala_geografica: "NACIONAL",
  });
  assert.equal(t.periodoCode, "VIO");
  assert.equal(t.yearPrincipal, 1950);
  assert.deepEqual(t.yearsSecondary, [1948]);
  assert.deepEqual(t.entidadesPersonas, ["Jorge Eliécer Gaitán"]);
  assert.equal(t.tipoPregunta, "causal");
  assert.equal(t.escalaGeografica, "nacional");
});

test("normalizeTaxonomy: período inválido + año → reconcilia", () => {
  const t = normalizeTaxonomy({ periodoCode: "XXX", yearPrincipal: 1985, categoriaCode: "ECO" });
  assert.equal(t.periodoCode, "CNA");
});

test("normalizeTaxonomy: año fuera del rango del período → reconcilia", () => {
  const t = normalizeTaxonomy({ periodoCode: "REG", yearPrincipal: 1700 });
  assert.equal(t.periodoCode, "COL");
});

test("normalizeTaxonomy: enums inválidos → null", () => {
  const t = normalizeTaxonomy({
    periodoCode: "TRANS",
    categoriaCode: "POL",
    tipoPregunta: "inventado",
    escalaGeografica: "galactica",
  });
  assert.equal(t.tipoPregunta, null);
  assert.equal(t.escalaGeografica, null);
});

test("normalizeTaxonomy: categoría inválida → fallback HIS", () => {
  const t = normalizeTaxonomy({ periodoCode: "TRANS", categoriaCode: "NOPE" });
  assert.equal(t.categoriaCode, "HIS");
});

// ── Resumen ──────────────────────────────────────────────────────────
console.log(`\n${pass} pasados, ${fail} fallidos`);
process.exit(fail ? 1 : 0);
