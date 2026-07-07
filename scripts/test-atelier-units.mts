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
import { ATELIER_FORMAT_LIST, isValidFormatId, targetWords } from "../src/lib/atelier-formats";
import { getFormatConfig } from "../src/lib/atelier/format-config";
import { getFormatPrompt } from "../src/lib/atelier/formats";
import {
  ENTITY_SERIES_TABS,
  SERIES_CATALOG_PAGE_SIZE,
  SERIES_DEFAULT_LONGITUD,
  SERIES_HIDE_PRODUCED_DEFAULT,
  buildSeriesCatalogPageUrl,
  buildSeriesEntityCatalogUrl,
  SERIES_REQUIRE_IMAGE,
  evaluateSeriesPoll,
  shouldFetchSeriesCatalogPage,
} from "../src/lib/atelier/series";
import {
  ACCENT_COLOR_EN,
  buildArtDirectorUserPrompt,
  type ArtDirection,
} from "../src/lib/atelier/art-director";
import { buildStyledPrompt } from "../src/lib/atelier/image-prompt";
import {
  applyDocumentaryScenePlan,
  buildReferenceBriefs,
  inferDocumentaryScenePlan,
} from "../src/lib/atelier/scene-plan";
import {
  REFERENCE_PROVIDER_NAMES,
  SCORE_BATCH_SIZE,
  buildCandidateScoreBatches,
  buildReferenceQuerySeeds,
  referenceContextFromStructured,
  type ReferenceCandidate,
} from "../src/lib/atelier/reference-search";
import type { StructuredData } from "../src/lib/typology-schemas";
import type { SearchResult } from "../src/lib/vector-search";
import type { VerifiedClaim, AtelierBrief } from "../src/lib/atelier/types";

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

// ── 7. Imagen editorial: dirección de arte + referentes ─────────────
group("imagen editorial");

test("la paleta de acento queda estrictamente en la bandera colombiana", () => {
  const colors = Object.keys(ACCENT_COLOR_EN);
  assert.deepEqual(colors.sort(), ["amarillo", "azul", "rojo"]);
});

test("el prompt desalienta oro, banderas y uniformes como default", () => {
  const direction: ArtDirection = {
    accentColor: "azul",
    accentTarget: "the indigo edge of one handwoven textile",
    accentTargetEs: "el borde índigo de un textil tejido",
    encuadre: "detalle",
    razon: "Prueba de variedad material.",
  };
  const prompt = buildStyledPrompt({
    subject: "A period-accurate archival scene in Colombia.",
    direction,
    withReferences: true,
  });
  assert.match(prompt, /Do not default to gold, flags or uniforms/i);
  assert.match(prompt, /secondary candidates/i);
});

test("el contexto de una época conserva anclas visuales concretas", () => {
  const structured: StructuredData = {
    typology: "epoca",
    slug: "republica-liberal",
    titulo: "República Liberal",
    resumen: "Un período de reformas políticas y vida urbana moderna.",
    periodoCode: "REP",
    rango: "1930-1946",
    panorama: "Reformas educativas, sindicalismo y expansión de nuevas infraestructuras.",
    hitos: [
      { year: 1936, titulo: "Reforma constitucional" },
      { year: 1942, titulo: "Expansión ferroviaria" },
    ],
    actores: ["Alfonso López Pumarejo", "María Cano"],
    transformaciones: ["escuelas públicas", "ferrocarriles", "sindicatos"],
    legado: "Amplió el vocabulario de ciudadanía social.",
  };
  const ctx = referenceContextFromStructured(structured) as ReturnType<typeof referenceContextFromStructured> & {
    visualAnchors?: string[];
  };
  assert.deepEqual(ctx.visualAnchors?.slice(0, 4), [
    "Alfonso López Pumarejo",
    "María Cano",
    "Reforma constitucional",
    "Expansión ferroviaria",
  ]);
  assert.ok(ctx.visualAnchors?.includes("ferrocarriles"));
});

test("el contexto de una época rescata personas y lugares del metadata del Atelier", () => {
  const structured: StructuredData = {
    typology: "epoca",
    slug: "frente-nacional",
    titulo: "El Frente Nacional",
    resumen: "Alternancia bipartidista y cierre político.",
    periodoCode: "FN",
    rango: "1958-1974",
    panorama: "Pactos de Benidorm y Sitges, plebiscito y nacimiento de oposiciones armadas.",
    hitos: [
      { year: 1957, titulo: "Plebiscito fundacional" },
      { year: 1964, titulo: "Operación Marquetalia" },
    ],
    actores: [],
    transformaciones: [],
    legado: "Cierre institucional y modernización estatal.",
  };
  const metadata = {
    atelier: {
      brief: {
        entities: {
          personas: [
            "Alberto Lleras Camargo",
            "Laureano Gómez",
            "Gustavo Rojas Pinilla",
            "Guillermo León Valencia",
            "Carlos Lleras Restrepo",
            "Misael Pastrana Borrero",
            "Alfonso López Michelsen",
            "Álvaro Gómez Hurtado",
          ],
          lugares: ["Benidorm", "Sitges", "Marquetalia"],
          instituciones: ["INCORA"],
        },
      },
      taxonomy: {
        entidadesPersonas: ["Camilo Torres Restrepo"],
        entidadesLugares: ["Bogotá"],
      },
    },
  };

  const ctx = referenceContextFromStructured(structured, { metadata }) as ReturnType<
    typeof referenceContextFromStructured
  > & { visualAnchors?: string[]; lugares?: string[] };
  const seeds = buildReferenceQuerySeeds(ctx);

  assert.deepEqual(ctx.visualAnchors?.slice(0, 3), [
    "Alberto Lleras Camargo",
    "Laureano Gómez",
    "Gustavo Rojas Pinilla",
  ]);
  assert.ok(ctx.visualAnchors?.includes("Camilo Torres Restrepo"));
  assert.ok(ctx.lugares?.includes("Benidorm"));
  assert.equal(seeds[0], "Alberto Lleras Camargo");
  assert.ok(seeds.slice(0, 9).includes("Benidorm"));
  assert.ok(seeds.includes("El Frente Nacional"));
});

test("el contexto de una persona marca búsqueda de retrato público", () => {
  const structured: StructuredData = {
    typology: "entidad",
    slug: "maria-cano",
    titulo: "María Cano",
    resumen: "Dirigente obrera y figura pública colombiana.",
    periodoCode: "REP",
    tipo: "Persona",
    nacimiento: "1887",
    muerte: "1967",
    roles: ["dirigente obrera", "oradora"],
    hitos: [{ year: 1925, titulo: "Giras obreras" }],
    relaciones: ["Partido Socialista Revolucionario", "Medellín"],
    semblanza: "Fue una figura reconocible en la vida pública y la prensa obrera.",
  };
  const ctx = referenceContextFromStructured(structured) as ReturnType<typeof referenceContextFromStructured> & {
    entityType?: string;
    visualIntent?: string;
    visualAnchors?: string[];
  };
  assert.equal(ctx.entityType, "Persona");
  assert.equal(ctx.visualIntent, "retrato-publico");
  assert.ok(ctx.visualAnchors?.includes("María Cano portrait"));
});

test("el director de arte recibe acentos recientes para no repetir la serie", () => {
  const prompt = buildArtDirectorUserPrompt({
    titulo: "Colonia (1600-1780)",
    resumen: "Vida urbana, minería, botánica y burocracia colonial.",
    typology: "epoca",
    periodoLabel: "1600-1780",
    subjectText: "A period-accurate colonial scene in New Granada.",
    referenceHints: ["Expedición Botánica — wikimedia, score 8"],
    avoidAccentTargets: ["polvo de oro en batea", "banderas rojas de cabildo"],
  });
  assert.match(prompt, /ACENTOS RECIENTES A EVITAR/);
  assert.match(prompt, /polvo de oro en batea/);
  assert.match(prompt, /elige otro detalle material/i);
});

test("el buscador registra fuentes públicas sin API key de alto valor", () => {
  for (const provider of ["internetarchive", "wellcome", "gallica", "rijksmuseum"]) {
    assert.ok(REFERENCE_PROVIDER_NAMES.includes(provider), `falta proveedor ${provider}`);
  }
});

test("el scoring de referencias parte listas grandes en lotes revisables", () => {
  const candidates: ReferenceCandidate[] = Array.from({ length: 263 }, (_, i) => ({
    provider: "fixture",
    title: `Candidato ${i + 1}`,
    url: `https://example.com/${i + 1}.jpg`,
    width: 800,
    height: 800,
    query: "Frente Nacional",
  }));
  const batches = buildCandidateScoreBatches(candidates);

  assert.ok(SCORE_BATCH_SIZE <= 60);
  assert.ok(batches.length > 1);
  assert.equal(batches.flat().length, candidates.length);
  assert.ok(batches.every((batch) => batch.length <= SCORE_BATCH_SIZE));
});

test("el prompt final declara las referencias seleccionadas antes del estilo", () => {
  const prompt = buildStyledPrompt({
    subject: "A documentary scene of Colombian bipartisan politics in the 1960s.",
    direction: {
      accentColor: "azul",
      accentTarget: "the blue ceramic inkwell on the government desk",
      accentTargetEs: "el tintero azul de cerámica sobre el escritorio gubernamental",
      encuadre: "interior",
      razon: "Condensa el cierre burocrático.",
    },
    withReferences: true,
    referenceNotes: [
      "Alberto Lleras Camargo portrait — wikimedia, score 9",
      "Plebiscito colombiano 1957 — google-images, score 8",
    ],
  });

  assert.match(prompt, /DOCUMENTARY REFERENCE SELECTION/i);
  assert.ok(prompt.indexOf("Alberto Lleras Camargo portrait") < prompt.indexOf("STYLE:"));
});

test("el tablero de referencias reconoce escenas políticas con personas como ancla principal de época", () => {
  const ctx = {
    titulo: "El Frente Nacional",
    resumen: "Alternancia bipartidista y cierre político.",
    typology: "época",
    periodoLabel: "1958-1974",
    visualIntent: "epoca-material" as const,
    visualAnchors: [
      "Carlos Lleras Restrepo",
      "Alberto Lleras Camargo",
      "Misael Pastrana Borrero",
      "Bogotá",
    ],
    lugares: ["Bogotá"],
  };
  const refs = buildReferenceBriefs(
    [
      {
        meta: {
          title: "Parlamentarios del Partido Liberal junto al Presidente Colombiano Carlos Lleras Restrepo",
          provider: "wikimedia",
          url: "https://example.com/ref1.jpg",
          score: 9,
        },
      },
      {
        meta: {
          title: "Misael Pastrana.JPG",
          provider: "wikimedia",
          url: "https://example.com/ref2.jpg",
          score: 8,
        },
      },
      {
        meta: {
          title: "Bogotá : Avenida de la República",
          provider: "rijksmuseum",
          url: "https://example.com/ref3.jpg",
          score: 6,
        },
      },
    ],
    ctx
  );
  const plan = inferDocumentaryScenePlan(
    {
      typology: "epoca",
      slug: "frente-nacional",
      titulo: "El Frente Nacional",
      resumen: "Alternancia bipartidista y cierre político.",
      periodoCode: "FN",
      rango: "1958-1974",
      panorama: "Pacto bipartidista, gobiernos alternados y cierre institucional.",
      hitos: [],
      actores: [],
      transformaciones: [],
      legado: "Dejó una democracia estable pero excluyente.",
    },
    ctx,
    refs
  );

  assert.equal(refs[0].role, "people-scene");
  assert.equal(plan?.mode, "public-scene");
  assert.equal(plan?.primaryReferenceIndex, 1);
  assert.match(plan?.anchorEs ?? "", /Parlamentarios/i);
  assert.match(plan?.constraints.join(" ") ?? "", /no reemplazarla por una metáfora/i);
});

test("la guardia documental evita que una época con escena política derive en bodegón de tintero", () => {
  const plan = {
    mode: "public-scene" as const,
    primaryReferenceIndex: 1,
    primaryReferenceTitle: "Parlamentarios del Partido Liberal junto al Presidente Colombiano Carlos Lleras Restrepo",
    anchorEs:
      "Escena política pública de mediados del siglo XX anclada en parlamentarios y presidentes del Frente Nacional.",
    anchorEn:
      "A mid-20th-century Colombian political gathering anchored in the parliamentarians and presidents from the main reference.",
    creativeMove: "A tense medium shot with formal suits, official room light and rigid institutional body language.",
    constraints: [
      "La escena principal debe venir de la referencia #1; no reemplazarla por una metáfora u objeto aislado.",
      "Debe haber figuras humanas de época; no bodegón sin personas.",
    ],
    warnings: [],
  };
  const direction = applyDocumentaryScenePlan(
    {
      accentColor: "azul",
      accentTarget:
        "a glass inkwell filled with blue-black ink on a government desk covered with stamped bureaucratic folders",
      accentTargetEs:
        "un tintero de vidrio con tinta azul-negra sobre un escritorio de madera cubierto de carpetas burocráticas selladas",
      encuadre: "interior",
      razon: "Condensa el pacto burocrático.",
    },
    plan,
    "epoca"
  );

  assert.equal(direction.sceneMode, "public-scene");
  assert.equal(direction.primaryReferenceIndex, 1);
  assert.equal(direction.encuadre, "plano-medio");
  assert.doesNotMatch(direction.accentTarget, /inkwell|desk|folders/i);
  assert.match(direction.escena ?? "", /political gathering/i);
  assert.ok(direction.warnings?.includes("accent-target-replaced-by-documentary-scene-guard"));
});

test("el prompt final pone la escena documental principal antes del acento y subordina el color", () => {
  const prompt = buildStyledPrompt({
    subject: "A documentary scene of Colombian bipartisan politics in the 1960s.",
    direction: {
      accentColor: "azul",
      accentTarget: "one small blue period detail held by a figure inside the political gathering",
      accentTargetEs: "un pequeño detalle azul dentro de la escena política",
      encuadre: "plano-medio",
      razon: "El azul sugiere el expediente institucional sin desplazar la escena pública.",
      sceneMode: "public-scene",
      primaryReferenceIndex: 1,
      sceneAnchor:
        "A mid-20th-century Colombian political gathering anchored in the parliamentarians and presidents from the main reference.",
      sceneAnchorEs:
        "Escena política pública de mediados del siglo XX anclada en parlamentarios y presidentes del Frente Nacional.",
      creativeMove: "A tense medium shot with formal suits and official room light.",
      historicalConstraints: ["Debe haber figuras humanas de época; no bodegón sin personas."],
    },
    withReferences: true,
    referenceNotes: [
      "Parlamentarios del Partido Liberal junto al Presidente Colombiano Carlos Lleras Restrepo — wikimedia, score 9",
      "Misael Pastrana.JPG — wikimedia, score 8",
    ],
  });

  assert.match(prompt, /MAIN DOCUMENTARY ANCHOR/i);
  assert.match(prompt, /The color accent is secondary/i);
  assert.ok(prompt.indexOf("MAIN DOCUMENTARY ANCHOR") < prompt.indexOf("STYLE:"));
  assert.ok(prompt.indexOf("MAIN DOCUMENTARY ANCHOR") < prompt.indexOf("Plus ONE restrained accent"));
});

// ── 7. Contrato de formatos del Taller ───────────────────────────────
group("formatos: cobertura de config + prompt (incl. podcast)");

function fakeBrief(formato: AtelierBrief["ficha"]["formato"]): AtelierBrief {
  return {
    thinking: "",
    tesisTentativa: "tesis interna de prueba",
    ejes: ["eje 1", "eje 2"],
    scope: "alcance de prueba",
    entities: {
      personas: ["Jorge Eliécer Gaitán"],
      instituciones: ["Partido Liberal"],
      lugares: ["Bogotá"],
      conceptos: ["populismo"],
      temporalidad: "1948",
    },
    hipotesis: {
      tesis: "T",
      antitesis: "A",
      sintesis: "S",
      tesisAlternas: ["otra lectura plausible"],
    },
    ficha: { formato, voz: "voz de prueba", extensionTarget: 2000 },
  };
}

test("el set de formatos incluye podcast y todos son válidos", () => {
  const ids = ATELIER_FORMAT_LIST.map((f) => f.id);
  assert.ok(ids.includes("podcast"), "falta el formato podcast");
  // 5 narrativos + 4 fichas del archivo (hecho/época/entidad/pregunta).
  assert.equal(ids.length, 9);
  for (const k of ["ficha-hecho", "ficha-epoca", "ficha-entidad", "ficha-pregunta"])
    assert.ok(ids.includes(k), `falta el formato ${k}`);
  for (const id of ids) assert.ok(isValidFormatId(id), `formato inválido: ${id}`);
});

test("cada formato tiene config con parámetros subidos (más fuentes/triangulación)", () => {
  for (const { id } of ATELIER_FORMAT_LIST) {
    const c = getFormatConfig(id);
    // Suelo mínimo: por encima de los viejos defaults globales (pool 100, ejes 8).
    assert.ok(c.poolTarget >= 120, `${id}: poolTarget bajo (${c.poolTarget})`);
    assert.ok(c.maxEjes >= 9, `${id}: maxEjes bajo (${c.maxEjes})`);
    assert.ok(c.maxRevisions >= 2, `${id}: maxRevisions bajo (${c.maxRevisions})`);
    assert.ok(c.hipotesisCandidatas >= 3, `${id}: pocas hipótesis (${c.hipotesisCandidatas})`);
    assert.ok(c.minNucleos <= c.maxNucleos && c.claimsMin <= c.claimsMax, `${id}: rangos invertidos`);
  }
});

test("el capítulo es el formato más exhaustivo (más fuentes que el resto)", () => {
  const cap = getFormatConfig("capitulo");
  for (const { id } of ATELIER_FORMAT_LIST) {
    if (id === "capitulo") continue;
    assert.ok(cap.poolTarget >= getFormatConfig(id).poolTarget, `capítulo no domina a ${id}`);
  }
});

test("cada formato construye un writer prompt no vacío y con # H1", () => {
  for (const { id } of ATELIER_FORMAT_LIST) {
    const fmt = getFormatPrompt(id);
    const sys = fmt.buildWriterSystemPrompt({
      brief: fakeBrief(id),
      verifiedContext: "### Núcleo\n- un hecho cotejado",
    });
    assert.ok(sys.length > 800, `${id}: prompt sospechosamente corto`);
    assert.ok(sys.includes("# H1") || /`# H1`/.test(sys), `${id}: no exige título # H1`);
    assert.ok(fmt.maxTokens > 0, `${id}: maxTokens inválido`);
    // La espina argumental con tesis alternas debe filtrarse al prompt.
    assert.ok(sys.includes("otra lectura plausible"), `${id}: no integra tesisAlternas`);
  }
});

// ── 8. Producción en serie: extensión + cierre de imagen ─────────────
group("producción en serie");

test("la producción en serie usa longitud extensa por defecto para todos los formatos", () => {
  assert.equal(SERIES_DEFAULT_LONGITUD, "extensa");
  for (const { id } of ATELIER_FORMAT_LIST) {
    assert.ok(
      targetWords(id, SERIES_DEFAULT_LONGITUD) > targetWords(id, "normal"),
      `${id}: la serie no sube extensión frente a normal`,
    );
  }
});

test("la producción en serie muestra pendientes por defecto", () => {
  assert.equal(SERIES_HIDE_PRODUCED_DEFAULT, true);
});

test("la producción en serie divide entidades por tipo", () => {
  assert.deepEqual(
    ENTITY_SERIES_TABS.map((t) => t.type),
    ["person", "place", "concept"],
  );
});

test("el catálogo de entidades en serie pide todas las entidades disponibles del tipo", () => {
  const url = buildSeriesEntityCatalogUrl("concept");
  assert.equal(url, "/api/entities?limit=all&minMentions=2&type=concept");
});

test("la paginación de serie no recorta preguntas o preguntas madre a 600 ítems", () => {
  assert.equal(SERIES_CATALOG_PAGE_SIZE, 100);
  assert.equal(buildSeriesCatalogPageUrl("/api/questions", 7), "/api/questions?page=7&limit=100");
  assert.equal(
    buildSeriesCatalogPageUrl("/api/preguntas-madre?status=READY", 7),
    "/api/preguntas-madre?status=READY&page=7&limit=100",
  );
  assert.equal(shouldFetchSeriesCatalogPage(7, 9), true);
  assert.equal(shouldFetchSeriesCatalogPage(10, 9), false);
});

test("la serie exige imagen completa antes de marcar una pieza como lista", () => {
  assert.equal(SERIES_REQUIRE_IMAGE, true);
  const action = evaluateSeriesPoll({
    status: "COMPLETE",
    metadata: { atelier: { stage: "complete" } },
    imageUrl: null,
    imageKey: null,
  });
  assert.equal(action.kind, "trigger-image");
});

test("la serie marca lista una producción COMPLETE con imagen ok o imageUrl persistida", () => {
  assert.equal(
    evaluateSeriesPoll({ status: "COMPLETE", metadata: { image: { status: "ok" } } }).kind,
    "done",
  );
  assert.equal(
    evaluateSeriesPoll({ status: "COMPLETE", metadata: {}, imageUrl: "/api/public-image/abc" }).kind,
    "done",
  );
});

test("la serie reintenta una imagen fallida una vez y luego reporta error", () => {
  assert.equal(
    evaluateSeriesPoll({ status: "COMPLETE", metadata: { image: { status: "error" } } }, { imageRetries: 0 }).kind,
    "trigger-image",
  );
  assert.equal(
    evaluateSeriesPoll({ status: "COMPLETE", metadata: { image: { status: "error" } } }, { imageRetries: 1 }).kind,
    "error",
  );
});

test("la serie sigue esperando piezas GENERATING e imagen generando", () => {
  assert.equal(evaluateSeriesPoll({ status: "GENERATING" }).kind, "wait");
  assert.equal(
    evaluateSeriesPoll({ status: "COMPLETE", metadata: { image: { status: "generando" } } }).kind,
    "wait",
  );
});

// ── Resumen ──────────────────────────────────────────────────────────
console.log(`\n${pass} pasados, ${fail} fallidos`);
process.exit(fail ? 1 : 0);
