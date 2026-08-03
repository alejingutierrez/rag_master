import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { metadata as loginMetadata } from "../src/app/login/layout";
import { robots } from "../src/app/robots";
import { trackEvent } from "../src/lib/analytics";
import { isAdminPath, isPublicPath } from "../src/lib/public-routes";
import {
  contextualSeoTitle,
  entityNodeJsonLd,
  entityNodeSeo,
  typologyJsonLd,
} from "../src/lib/seo";
import type { StructuredData } from "../src/lib/typology-schemas";

const ctx = {
  path: "/hechos/prueba",
  description: "Descripción editorial de prueba.",
  datePublished: "2026-07-01T00:00:00.000Z",
  dateModified: "2026-08-01T00:00:00.000Z",
};

const fact = typologyJsonLd(
  {
    typology: "hecho",
    slug: "prueba",
    titulo: "Hecho histórico de prueba",
    resumen: "Resumen",
    anioInicio: 1810,
    anioFin: 1819,
    lugares: ["Nueva Granada"],
    protagonistas: ["Simón Bolívar"],
  } as StructuredData,
  ctx,
);
assert.equal(fact["@type"], "Article");
assert.equal(fact.temporalCoverage, "1810/1819");
assert.equal("startDate" in fact, false);

const question = typologyJsonLd(
  {
    typology: "pregunta",
    slug: "pregunta-prueba",
    titulo: "Pregunta histórica de prueba",
    resumen: "Resumen",
    pregunta: "¿Qué ocurrió?",
    tesis: "Una respuesta editorial.",
  } as StructuredData,
  { ...ctx, path: "/preguntas/pregunta-prueba" },
);
assert.equal(question["@type"], "Article");
assert.equal("mainEntity" in question, false);
assert.deepEqual(question.about, {
  "@type": "Question",
  name: "¿Qué ocurrió?",
  text: "¿Qué ocurrió?",
});

const robotsText = JSON.stringify(robots());
assert.match(robotsText, /\/api\/public-image\//);
assert.doesNotMatch(robotsText, /\/admin/);

const loginMetadataText = JSON.stringify(loginMetadata);
assert.match(loginMetadataText, /\/login/);
assert.match(loginMetadataText, /"index":false/);
assert.equal(isPublicPath("/privacidad"), true);
assert.equal(isAdminPath("/admin"), true);
assert.equal(isAdminPath("/admin/home"), true);
assert.equal(isAdminPath("/admin-falso"), false);
assert.equal(isAdminPath("/ruta-publica-inexistente"), false);
assert.equal(
  contextualSeoTitle("Camilo Torres Restrepo: sacerdote, sociólogo y guerrillero", "análisis"),
  "Camilo Torres Restrepo: sacerdote, sociólogo · análisis",
);

const entityNode = entityNodeJsonLd({
  type: "persona",
  path: "/personas/persona-prueba",
  name: "Persona de prueba",
  description: "Descripción",
  indexPath: "/personas",
  indexLabel: "Personas",
});
assert.deepEqual(
  (entityNode["@graph"] as Array<Record<string, unknown>>).map((node) => node["@type"]),
  ["Person", "BreadcrumbList"],
);
const aggregateSeo = entityNodeSeo({
  name: "Lugar de prueba",
  description: "Descripción extensa ".repeat(30),
  typeLabel: "Lugar",
});
assert.ok(aggregateSeo.metaDescription.length <= 155);
assert.deepEqual(aggregateSeo.keywords, ["Lugar de prueba", "Lugar", "historia de Colombia"]);

const entityOverrides = JSON.parse(
  readFileSync(new URL("../src/data/entity-overrides.json", import.meta.url), "utf8"),
) as Record<string, { _motivo?: string }>;
assert.equal(
  entityOverrides["persona:ingrid-betancourt-pulecio"]?._motivo,
  'QA: duplicado de "Ingrid Betancourt"',
);
assert.equal(
  entityOverrides["persona:rafael-pardo-rueda"]?._motivo,
  'QA: duplicado de "Rafael Pardo"',
);

(globalThis as unknown as { window: unknown }).window = {
  dataLayer: [],
  localStorage: { getItem: () => "granted" },
};
trackEvent("view_content", { content_type: "hecho", item_id: "prueba" });
assert.deepEqual(
  (globalThis as unknown as { window: { dataLayer?: unknown[] } }).window.dataLayer,
  [{ content_type: "hecho", item_id: "prueba", event: "view_content" }],
);
(globalThis as unknown as { window: { dataLayer: unknown[]; localStorage: unknown } }).window = {
  dataLayer: [],
  localStorage: { getItem: () => "denied" },
};
trackEvent("view_content", { content_type: "hecho" });
assert.deepEqual(
  (globalThis as unknown as { window: { dataLayer: unknown[] } }).window.dataLayer,
  [],
);

console.log("SEO tests: 23 passed");
