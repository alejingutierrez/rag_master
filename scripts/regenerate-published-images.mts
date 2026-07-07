/**
 * Regenera portadas de piezas publicadas usando el pipeline actual de imagen.
 *
 * Uso:
 *   npx tsx scripts/regenerate-published-images.mts --dry-run
 *   npx tsx scripts/regenerate-published-images.mts --typology=epoca --limit=3
 *   npx tsx scripts/regenerate-published-images.mts --typology=all --only-missing
 *
 * Por defecto filtra épocas publicadas. La operación real sobreescribe imageKey
 * en S3 y actualiza imageUrl/imageGeneratedAt/metadata.image en BD.
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { generateAndStoreImage, isOpenAIConfigured } from "../src/lib/atelier/image";
import { normalizeStructured, type TypologyKind } from "../src/lib/typology-schemas";

type TypologyFilter = TypologyKind | "all";

function arg(name: string, fallback = ""): string {
  const prefix = `--${name}=`;
  const inline = process.argv.find((a) => a.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1] ?? fallback;
  return fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseTypology(value: string): TypologyFilter {
  if (value === "all" || value === "hecho" || value === "epoca" || value === "entidad" || value === "pregunta") {
    return value;
  }
  throw new Error(`--typology inválida: ${value}. Usa epoca|hecho|entidad|pregunta|all.`);
}

function imageStatus(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "sin-meta";
  const image = (metadata as { image?: { status?: string; ancla?: string; acento?: { objetivo?: string } } }).image;
  if (!image) return "sin-meta";
  return [image.status, image.ancla, image.acento?.objetivo].filter(Boolean).join(" · ");
}

async function main(): Promise<void> {
  const dryRun = hasFlag("dry-run");
  const onlyMissing = hasFlag("only-missing");
  const typology = parseTypology(arg("typology", arg("kind", "epoca")));
  const limitRaw = arg("limit", "all");
  const limit = limitRaw === "all" ? Infinity : Math.max(1, Number(limitRaw));
  if (!Number.isFinite(limit) && limitRaw !== "all") throw new Error(`--limit inválido: ${limitRaw}`);
  const ids = arg("ids")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const rows = await prisma.deliverable.findMany({
    where: {
      status: "COMPLETE",
      publishedAt: { not: null },
      ...(ids.length ? { id: { in: ids } } : {}),
    },
    select: {
      id: true,
      userQuestion: true,
      templateId: true,
      structuredData: true,
      publishedAt: true,
      imageUrl: true,
      metadata: true,
      question: { select: { pregunta: true } },
    },
    orderBy: { publishedAt: "desc" },
  });

  const candidates = rows
    .map((row) => ({ row, structured: normalizeStructured(row.structuredData) }))
    .filter(({ row, structured }) => {
      if (!structured) return false;
      if (typology !== "all" && structured.typology !== typology) return false;
      if (onlyMissing && row.imageUrl) return false;
      return true;
    })
    .slice(0, limit);

  console.log(
    `[regen-images] publicados=${rows.length} filtro=${typology} seleccionados=${candidates.length} dryRun=${dryRun} onlyMissing=${onlyMissing}`
  );

  for (const { row, structured } of candidates) {
    const title = structured?.titulo ?? row.question?.pregunta ?? row.userQuestion ?? row.id;
    console.log(
      `- ${row.id} · ${structured?.typology ?? "sin-tipologia"} · ${title} · imagen=${row.imageUrl ? "sí" : "no"} · ${imageStatus(row.metadata)}`
    );
  }

  if (dryRun || candidates.length === 0) return;
  if (!isOpenAIConfigured()) throw new Error("OPENAI_API_KEY no configurado");

  let ok = 0;
  let failed = 0;
  for (const { row, structured } of candidates) {
    const title = structured?.titulo ?? row.question?.pregunta ?? row.userQuestion ?? row.id;
    const started = Date.now();
    try {
      console.log(`\n[regen-images] generando ${row.id} · ${title}`);
      const result = await generateAndStoreImage(row.id);
      ok++;
      console.log(`[regen-images] ok ${row.id} · ${result.imageUrl} · ${Math.round((Date.now() - started) / 1000)}s`);
    } catch (e) {
      failed++;
      console.error(`[regen-images] ERROR ${row.id}: ${(e as Error).message}`);
    }
  }

  console.log(`\n[regen-images] terminado ok=${ok} failed=${failed}`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(`[regen-images] fatal: ${(e as Error).stack ?? (e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
