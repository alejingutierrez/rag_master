// Verifica si el deep research que el cliente perdió, terminó en backend
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const recent = await prisma.deliverable.findMany({
  where: { source: "deep_research" },
  select: {
    id: true,
    status: true,
    userQuestion: true,
    answer: true,
    chunksUsed: true,
    createdAt: true,
    updatedAt: true,
  },
  orderBy: { createdAt: "desc" },
  take: 5,
});

console.log(`Deep research deliverables encontrados: ${recent.length}`);
for (const d of recent) {
  const words = d.answer.split(/\s+/).length;
  const chunksCount = Array.isArray(d.chunksUsed) ? d.chunksUsed.length : 0;
  const citations = (d.answer.match(/\[#\d+(?:\s*,\s*\d+)*\]/g) ?? []).length;
  console.log(`\n--- ${d.id} ---`);
  console.log(`Status: ${d.status}`);
  console.log(`Creado: ${d.createdAt.toISOString()}`);
  console.log(`Pregunta: ${(d.userQuestion ?? "").slice(0, 100)}`);
  console.log(`Palabras: ${words} | Chunks: ${chunksCount} | Citas inline: ${citations}`);
  // Detectar secciones
  const sections = {
    "El problema": /^##\s+El problema/m.test(d.answer),
    "Sobre las fuentes": /^##\s+Sobre las fuentes/m.test(d.answer),
    "Tensiones": /^##\s+Tensiones/m.test(d.answer),
    "Vacíos paper": /^##\s+Lo que las fuentes/m.test(d.answer),
    "Conclusión": /^##\s+Conclusión/m.test(d.answer),
    "Cronología": /^##\s+Cronolog[íi]a/m.test(d.answer),
    "Actores principales": /^##\s+Actores principales/m.test(d.answer),
    "Vacíos corpus": /^##\s+Lo que el corpus no responde/m.test(d.answer),
    "Referencias": /^##\s+Referencias/m.test(d.answer),
  };
  console.log("Secciones:");
  for (const [k, v] of Object.entries(sections)) console.log(`  ${v ? "✓" : "✗"} ${k}`);

  const biblioCount = (d.answer.match(/^##\s+(Referencias|Bibliograf[íi]a|Fuentes)/gm) ?? []).length;
  console.log(`Bibliografías (debe ser 1): ${biblioCount}`);
}

await prisma.$disconnect();
