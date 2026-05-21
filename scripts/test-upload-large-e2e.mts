/**
 * Test E2E con PDF grande: verifica que el flujo por lotes funciona
 * con múltiples chunks y múltiples invocaciones al endpoint /process
 *
 * Uso: npx tsx scripts/test-upload-large-e2e.mts [url-base]
 */

const BASE_URL = process.argv[2] || "https://main.d2sayha59t6h2h.amplifyapp.com";

// Genera un PDF con texto largo (muchos párrafos para generar múltiples chunks)
function createLargePDF(): Uint8Array {
  const paragraphs = [
    "La inteligencia artificial generativa ha transformado radicalmente la manera en que procesamos y comprendemos grandes volumenes de informacion textual. Los sistemas RAG (Retrieval Augmented Generation) representan un avance significativo al combinar la busqueda vectorial con modelos de lenguaje para proporcionar respuestas precisas basadas en documentos especificos.",
    "El proceso de embedding convierte texto en representaciones numericas de alta dimension que capturan el significado semantico. Modelos como Cohere Embed v4 generan vectores de 1536 dimensiones que permiten calcular la similitud coseno entre fragmentos de texto, facilitando la recuperacion de informacion relevante.",
    "Amazon Bedrock proporciona acceso a multiples modelos de fundacion a traves de una API unificada. La integracion con servicios como S3 para almacenamiento y RDS con pgvector para busqueda vectorial permite construir pipelines completos de procesamiento documental en la nube de AWS.",
    "El chunking o fragmentacion de documentos es una etapa critica en el pipeline RAG. Estrategias como el chunking fijo con solapamiento, el chunking por parrafos y el chunking por oraciones ofrecen diferentes compromisos entre preservacion de contexto y granularidad de busqueda.",
    "Los sistemas de gestion documental modernos deben manejar eficientemente documentos de diversos formatos y tamanos. La extraccion de texto de PDFs presenta desafios particulares cuando los documentos contienen imagenes, tablas complejas o texto escaneado que requiere OCR.",
    "La arquitectura serverless de AWS Amplify permite desplegar aplicaciones web completas con funciones Lambda que procesan solicitudes bajo demanda. Sin embargo, los limites de tiempo de ejecucion requieren estrategias de procesamiento asincronico para tareas que exceden los timeouts configurados.",
    "PostgreSQL con la extension pgvector proporciona capacidades de busqueda vectorial nativas en una base de datos relacional madura. Indices HNSW (Hierarchical Navigable Small World) aceleran las consultas de vecinos mas cercanos, esenciales para sistemas RAG de produccion.",
    "La observabilidad en sistemas RAG incluye el monitoreo de latencias de embedding, tasas de acierto en busquedas vectoriales, calidad de respuestas generadas y consumo de tokens en modelos de lenguaje. Metricas como la similitud promedio y la relevancia del contexto recuperado son indicadores clave.",
    "El procesamiento por lotes de embeddings optimiza el rendimiento al reducir la sobrecarga de red y aprovechar el paralelismo del servicio de inferencia. Estrategias de backoff exponencial manejan graciosamente situaciones de throttling sin perder trabajo ya realizado.",
    "La seguridad en pipelines RAG abarca la proteccion de documentos sensibles durante el almacenamiento y procesamiento, el control de acceso basado en roles para busquedas vectoriales y la prevencion de inyeccion de prompts que podria comprometer la integridad de las respuestas.",
    "Los modelos de lenguaje como Claude Opus combinan capacidades avanzadas de razonamiento con comprension profunda del contexto proporcionado. La ventana de contexto extendida permite incluir multiples fragmentos recuperados para generar respuestas mas completas y matizadas.",
    "El preprocesamiento de texto antes del embedding incluye normalizacion de caracteres Unicode, eliminacion de encabezados y pies de pagina repetitivos, deteccion de idioma y manejo de texto estructurado como tablas y listas que requieren tratamiento especial.",
    "Las metricas de evaluacion para sistemas RAG incluyen precision y recall en la recuperacion de documentos, coherencia y fidelidad de las respuestas generadas, latencia end-to-end y costos por consulta. Benchmarks como RAGAS proporcionan marcos estandarizados de evaluacion.",
    "La escalabilidad horizontal de sistemas RAG se logra mediante particionamiento de indices vectoriales, distribucion geografica de replicas de lectura y cache de embeddings frecuentes. Arquitecturas event-driven permiten procesar documentos nuevos sin impactar el rendimiento de consultas.",
    "El enriquecimiento de documentos mediante IA generativa agrega metadatos estructurados como resumenes automaticos, palabras clave extraidas, categorias tematicas y entidades reconocidas. Este enriquecimiento mejora tanto la busqueda vectorial como la presentacion de resultados al usuario.",
  ];

  // Repetir párrafos para generar contenido largo (~15000 chars → ~5+ chunks con chunkSize=3000)
  const fullText = [...paragraphs, ...paragraphs].join("\n\n");

  // Generar PDF con stream de texto
  const words = fullText.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    if (currentLine.length + word.length > 70) {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  const streamLines = ["BT", "/F1 10 Tf", "40 752 Td", "12 TL"];
  for (const line of lines) {
    const escaped = line.replace(/([()])/g, "\\$1");
    streamLines.push(`(${escaped}) '`);
  }
  streamLines.push("ET");
  const streamContent = streamLines.join("\n");

  const pdfLines = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `4 0 obj << /Length ${streamContent.length} >> stream`,
    streamContent,
    "endstream endobj",
  ];

  const bodyStr = pdfLines.join("\n") + "\n";
  const xrefOffset = bodyStr.length;
  const offsets: string[] = [];
  for (let obj = 1; obj <= 5; obj++) {
    const idx = bodyStr.indexOf(`${obj} 0 obj`);
    if (idx >= 0) offsets.push(String(idx).padStart(10, "0") + " 00000 n ");
  }

  const trailer = [
    "xref", "0 6", "0000000000 65535 f ", ...offsets,
    "trailer << /Size 6 /Root 1 0 R >>",
    "startxref", String(xrefOffset), "%%EOF",
  ];

  return new TextEncoder().encode(bodyStr + trailer.join("\n"));
}

async function testLargeUpload() {
  console.log(`\n🧪 Test E2E de PDF grande (múltiples chunks)`);
  console.log(`📍 URL: ${BASE_URL}\n`);

  // 1. Crear PDF grande
  const pdfContent = createLargePDF();
  const filename = `test-large-e2e-${Date.now()}.pdf`;
  console.log(`📄 ${filename} (${pdfContent.byteLength} bytes)\n`);

  // 2. Presign + Upload a S3
  console.log("1️⃣  Subiendo a S3...");
  const presignRes = await fetch(`${BASE_URL}/api/documents/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType: "application/pdf" }),
  });
  if (!presignRes.ok) throw new Error(`Presign falló: ${presignRes.status}`);
  const { url, s3Key, s3Url } = await presignRes.json();

  const uploadRes = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: pdfContent,
  });
  if (!uploadRes.ok) throw new Error(`Upload falló: ${uploadRes.status}`);
  console.log("   ✅ Subido\n");

  // 3. Fase 1: Parsear + Chunks
  console.log("2️⃣  Fase 1: Parseando y chunkeando...");
  const t1 = Date.now();
  const docRes = await fetch(`${BASE_URL}/api/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      s3Key, s3Url, filename,
      fileSize: pdfContent.byteLength,
      chunkSize: 3000, chunkOverlap: 750, strategy: "FIXED",
    }),
  });

  if (!docRes.ok) {
    const err = await docRes.text();
    throw new Error(`Fase 1 falló: ${docRes.status} - ${err}`);
  }

  const docData = await docRes.json();
  const documentId = docData.document.id;
  const chunkCount = docData.document._count?.chunks ?? 0;
  const t1ms = Date.now() - t1;
  console.log(`   ✅ ${chunkCount} chunks en ${t1ms}ms (sin timeout!)\n`);

  if (chunkCount <= 1) {
    console.log("   ⚠️  Solo 1 chunk — test de lotes no es significativo.\n");
  }

  // 4. Fase 2: Embeddings por lotes
  console.log("3️⃣  Fase 2: Generando embeddings por lotes...");
  const t2 = Date.now();
  let iteration = 0;
  let retries = 0;

  while (true) {
    iteration++;
    const res = await fetch(`${BASE_URL}/api/documents/${documentId}/process`, {
      method: "POST",
    });

    if (res.status === 429) {
      retries++;
      if (retries > 5) throw new Error("Throttling persistente");
      const wait = Math.pow(2, retries) * 2000;
      console.log(`   ⏳ Throttled, esperando ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Fase 2 falló: ${res.status} - ${err}`);
    }

    retries = 0;
    const p = await res.json();
    const pct = Math.round((p.processedChunks / p.totalChunks) * 100);
    console.log(`   📊 Lote ${iteration}: ${p.processedChunks}/${p.totalChunks} (${pct}%) — ${p.status}`);

    if (p.status === "READY") break;
  }

  const t2ms = Date.now() - t2;
  console.log(`   ✅ Completado en ${t2ms}ms (${iteration} lotes)\n`);

  // 5. Verificación final
  console.log("4️⃣  Verificación final...");
  const verifyRes = await fetch(`${BASE_URL}/api/documents?limit=5`);
  const verifyData = await verifyRes.json();
  const doc = verifyData.documents?.find((d: { id: string }) => d.id === documentId);

  if (!doc || doc.status !== "READY") {
    throw new Error(`Documento no READY: ${doc?.status ?? "no encontrado"}`);
  }
  console.log(`   ✅ Status: ${doc.status}, Chunks: ${doc._count?.chunks}\n`);

  // 6. Probar búsqueda vectorial con el documento
  console.log("5️⃣  Probando búsqueda vectorial...");
  const searchRes = await fetch(`${BASE_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "inteligencia artificial RAG embeddings",
      topK: 5,
    }),
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const results = searchData.results || [];
    const fromThisDoc = results.filter((r: { documentId: string }) => r.documentId === documentId);
    console.log(`   📊 ${results.length} resultados totales, ${fromThisDoc.length} de este documento`);
    if (fromThisDoc.length > 0) {
      console.log(`   ✅ Búsqueda vectorial funciona\n`);
    } else {
      console.log(`   ⚠️  Sin resultados del documento de prueba (puede ser normal por similitud baja)\n`);
    }
  } else {
    console.log(`   ⚠️  Búsqueda no disponible (${searchRes.status})\n`);
  }

  // 7. Cleanup
  console.log("6️⃣  Limpiando...");
  const delRes = await fetch(`${BASE_URL}/api/documents/${documentId}`, { method: "DELETE" });
  console.log(`   ${delRes.ok ? "✅ Eliminado" : `⚠️ No eliminado (${delRes.status})`}\n`);

  const totalMs = t1ms + t2ms;
  console.log("═══════════════════════════════════════════════");
  console.log("✅ TEST E2E GRANDE COMPLETADO EXITOSAMENTE");
  console.log(`📊 Chunks: ${chunkCount}`);
  console.log(`📊 Lotes de embeddings: ${iteration}`);
  console.log(`⏱️  Fase 1 (parseo): ${t1ms}ms`);
  console.log(`⏱️  Fase 2 (embeddings): ${t2ms}ms`);
  console.log(`⏱️  Total: ${totalMs}ms`);
  console.log("═══════════════════════════════════════════════\n");
}

testLargeUpload().catch((err) => {
  console.error("\n❌ TEST FALLÓ:", err.message);
  process.exit(1);
});
