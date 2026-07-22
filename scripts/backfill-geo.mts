/**
 * Backfill de ANCLAJE GEOGRÁFICO (lugarPrincipal / lat / lng) en las piezas ya
 * publicadas. De aquí en adelante el Taller las genera solo (ver
 * src/lib/atelier/typology-extractor.ts); este script cubre el pasado.
 *
 * Es COOPERATIVO y REANUDABLE: guarda un dump JSON por lote y solo escribe en la
 * base cuando se le pasa APPLY=1. El flujo pensado es:
 *
 *   1. npx tsx scripts/backfill-geo.mts            → propone y guarda el dump
 *   2. revisar tmp/geo-backfill.json               → control humano
 *   3. APPLY=1 npx tsx scripts/backfill-geo.mts    → escribe lo ya revisado
 *
 * Sin APPLY=1 NUNCA toca la base: la de producción es de solo lectura por defecto.
 *
 * Variables: LIMIT (piezas por corrida) · FORCE=1 (recalcula las que ya tienen geo)
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "../src/lib/prisma";

/** Mismo filtro que el sitio público: solo piezas del Taller ya publicadas. */
const PUBLISHED_WHERE = {
  status: "COMPLETE" as const,
  source: "atelier",
  publishedAt: { not: null },
};

const DUMP = "tmp/geo-backfill.json";
const MODEL = process.env.GEO_MODEL || "gpt-5";
const APPLY = process.env.APPLY === "1";
const FORCE = process.env.FORCE === "1";
const LIMIT = parseInt(process.env.LIMIT || "500", 10);
const BATCH = 12;

/** Caja de Colombia con margen. Fuera de ella el punto se marca, no se descarta:
 *  hay piezas que de verdad ocurren en Madrid, Panamá o Caracas. */
const CO = { latMin: -4.5, latMax: 13.6, lngMin: -82.2, lngMax: -66.6 };

interface Proposal {
  id: string;
  titulo: string;
  typology: string;
  periodoCode: string | null;
  lugarPrincipal: string | null;
  lat: number | null;
  lng: number | null;
  outsideColombia: boolean;
}

function inColombia(lat: number, lng: number): boolean {
  return lat >= CO.latMin && lat <= CO.latMax && lng >= CO.lngMin && lng <= CO.lngMax;
}

const SYSTEM = `Eres un geógrafo histórico de Colombia. Para cada pieza recibes su título, resumen y los lugares que menciona, y devuelves su ANCLAJE GEOGRÁFICO principal.

Devuelve JSON PURO: {"items":[{"id","lugarPrincipal","lat","lng"}]}

Reglas:
- Elige el punto MÁS ESPECÍFICO que la pieza sustente, bajando de precisión si no lo sustenta:
  sitio exacto (Plaza de Bolívar, Bogotá) > municipio (Ciénaga, Magdalena) > departamento (Chocó) > región (Amazonía).
- hecho: dónde ocurrió. Si abarca varios sitios, el más definitorio.
- entidad Lugar: el lugar mismo. entidad Persona: donde transcurre lo esencial de su vida pública,
  no su natalicio si su obra fue en otra parte. entidad Concepto/Institución: su sede o foco geográfico.
- epoca: el centro de gravedad del período. pregunta: el territorio que interroga.
- Coordenadas decimales WGS84, punto decimal. Colombia: lat -4.3…13.5, lng -82…-66.8.
  Un punto fuera de Colombia solo si la pieza de verdad ocurre allí (Madrid, Panamá tras 1903, Caracas).
- Si no hay anclaje defendible, usa null en lat y lng. Es mejor no ubicar que ubicar mal.
- Un item por cada id recibido, en el mismo orden. Nada fuera del JSON.`;

async function askOpenAI(payload: unknown): Promise<{ items: Proposal[] }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content);
}

function loadDump(): Record<string, Proposal> {
  if (!existsSync(DUMP)) return {};
  try {
    return JSON.parse(readFileSync(DUMP, "utf8"));
  } catch {
    return {};
  }
}

function saveDump(d: Record<string, Proposal>) {
  mkdirSync(dirname(DUMP), { recursive: true });
  writeFileSync(DUMP, JSON.stringify(d, null, 2));
}

async function main() {
  const all = await prisma.deliverable.findMany({
    where: PUBLISHED_WHERE,
    select: { id: true, structuredData: true },
  });
  const rows = all.filter((r) => r.structuredData && typeof r.structuredData === "object");

  const dump = loadDump();

  // ── Fase APLICAR: escribe en la base lo que ya está en el dump revisado ────
  if (APPLY) {
    const pending = Object.values(dump).filter((p) => p.lat != null && p.lng != null);
    console.log(`APPLY: escribiendo ${pending.length} anclajes en la base…`);
    let written = 0;
    for (const p of pending) {
      const row = rows.find((r) => r.id === p.id);
      if (!row) continue;
      const s = (row.structuredData ?? {}) as Record<string, unknown>;
      if (!FORCE && s.lat != null && s.lng != null) continue;
      await prisma.deliverable.update({
        where: { id: p.id },
        data: {
          structuredData: {
            ...s,
            lugarPrincipal: p.lugarPrincipal,
            lat: p.lat,
            lng: p.lng,
          },
        },
      });
      written++;
      if (written % 25 === 0) console.log(`  … ${written}/${pending.length}`);
    }
    console.log(`✓ ${written} piezas actualizadas.`);
    await prisma.$disconnect();
    return;
  }

  // ── Fase PROPONER: consulta el modelo y guarda el dump (no toca la base) ───
  const todo = rows
    .filter((r) => {
      const s = (r.structuredData ?? {}) as Record<string, unknown>;
      if (!FORCE && s.lat != null && s.lng != null) return false;
      return FORCE || !dump[r.id];
    })
    .slice(0, LIMIT);

  console.log(`${rows.length} piezas publicadas · ${todo.length} por geolocalizar · modelo ${MODEL}`);
  if (todo.length === 0) {
    console.log("Nada pendiente. Revisa el dump y corre con APPLY=1 para escribir.");
    await prisma.$disconnect();
    return;
  }

  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const payload = slice.map((r) => {
      const s = (r.structuredData ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        titulo: s.titulo,
        typology: s.typology,
        tipo: s.tipo ?? null,
        resumen: String(s.resumen ?? "").slice(0, 400),
        lugares: s.lugares ?? [],
        periodoCode: s.periodoCode ?? null,
      };
    });

    try {
      const out = await askOpenAI({ items: payload });
      for (const item of out.items ?? []) {
        const src = slice.find((r) => r.id === item.id);
        if (!src) continue;
        const s = (src.structuredData ?? {}) as Record<string, unknown>;
        const lat = typeof item.lat === "number" && Number.isFinite(item.lat) ? item.lat : null;
        const lng = typeof item.lng === "number" && Number.isFinite(item.lng) ? item.lng : null;
        dump[item.id] = {
          id: item.id,
          titulo: String(s.titulo ?? ""),
          typology: String(s.typology ?? ""),
          periodoCode: (s.periodoCode as string) ?? null,
          lugarPrincipal: item.lugarPrincipal ?? null,
          lat,
          lng,
          outsideColombia: lat != null && lng != null ? !inColombia(lat, lng) : false,
        };
      }
      saveDump(dump);
      console.log(`  lote ${i / BATCH + 1}: ${Object.keys(dump).length} propuestas acumuladas`);
    } catch (e) {
      console.warn(`  lote ${i / BATCH + 1} falló: ${(e as Error).message}`);
    }
  }

  const proposals = Object.values(dump);
  const located = proposals.filter((p) => p.lat != null);
  const outside = located.filter((p) => p.outsideColombia);
  console.log(`\n✓ Dump en ${DUMP}`);
  console.log(`  ${located.length}/${proposals.length} con coordenadas · ${outside.length} fuera de Colombia`);
  if (outside.length) {
    console.log("  Fuera de Colombia (revisar):");
    for (const p of outside.slice(0, 20)) {
      console.log(`   · ${p.titulo} → ${p.lugarPrincipal} (${p.lat}, ${p.lng})`);
    }
  }
  console.log("\nRevisa el dump y luego: APPLY=1 npx tsx scripts/backfill-geo.mts");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
