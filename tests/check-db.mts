import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 1. Document status
  const docs = await prisma.document.findMany({
    include: { _count: { select: { chunks: true } } },
  });
  console.log("═══ DOCUMENTS ═══");
  for (const d of docs) {
    console.log(`  ${d.filename}: status=${d.status}, pages=${d.pageCount}, chunks=${d._count.chunks}`);
  }

  // 2. Chunks with/without embeddings
  for (const d of docs) {
    const withEmb = await prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
      `SELECT count(*) as cnt FROM chunks WHERE "documentId" = $1 AND embedding IS NOT NULL`,
      d.id
    );
    const withoutEmb = await prisma.$queryRawUnsafe<[{ cnt: bigint }]>(
      `SELECT count(*) as cnt FROM chunks WHERE "documentId" = $1 AND embedding IS NULL`,
      d.id
    );
    console.log(`  → Embeddings: ${withEmb[0].cnt} con, ${withoutEmb[0].cnt} sin`);
  }

  // 3. Sample chunks content
  console.log("\n═══ SAMPLE CHUNKS (first 5) ═══");
  const chunks = await prisma.chunk.findMany({
    take: 5,
    orderBy: { chunkIndex: "asc" },
    select: { chunkIndex: true, pageNumber: true, content: true, strategy: true, chunkSize: true },
  });
  for (const c of chunks) {
    console.log(`  [${c.chunkIndex}] page=${c.pageNumber} strategy=${c.strategy} size=${c.chunkSize} len=${c.content.length}`);
    console.log(`    "${c.content.substring(0, 120)}..."`);
  }

  // 4. Page coverage
  console.log("\n═══ PAGE COVERAGE ═══");
  const pages = await prisma.$queryRawUnsafe<{ pageNumber: number; cnt: bigint }[]>(
    `SELECT "pageNumber", count(*) as cnt FROM chunks GROUP BY "pageNumber" ORDER BY "pageNumber"`
  );
  console.log(`  Pages with chunks: ${pages.length} (of 258)`);
  console.log(`  Range: ${pages[0]?.pageNumber} to ${pages[pages.length - 1]?.pageNumber}`);

  // 5. Search test
  console.log("\n═══ SEARCH TEST: 'cómo llegó el marxismo a Colombia' ═══");
  const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
  const bedrock = new BedrockRuntimeClient({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const embResp = await bedrock.send(new InvokeModelCommand({
    modelId: "amazon.titan-embed-text-v2:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({ inputText: "cómo llegó el marxismo a Colombia", dimensions: 1024, normalize: true }),
  }));
  const queryEmb = JSON.parse(new TextDecoder().decode(embResp.body)).embedding;
  const embStr = `[${queryEmb.join(",")}]`;

  const results = await prisma.$queryRawUnsafe<
    Array<{ id: string; content: string; pageNumber: number; similarity: number }>
  >(
    `SELECT c.id, c.content, c."pageNumber",
      1 - (c.embedding <=> '${embStr}'::vector) as similarity
     FROM chunks c
     WHERE c.embedding IS NOT NULL
     ORDER BY c.embedding <=> '${embStr}'::vector
     LIMIT 10`
  );
  console.log(`  Results: ${results.length}`);
  for (const r of results) {
    console.log(`  sim=${Number(r.similarity).toFixed(4)} page=${r.pageNumber} "${r.content.substring(0, 100)}..."`);
  }

  await prisma.$disconnect();
}
main().catch(console.error);
