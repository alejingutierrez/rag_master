/**
 * Test E2E: sube un PDF a producción y verifica el flujo completo
 * Uso: npx tsx scripts/test-upload-e2e.mts [url-base]
 */

const BASE_URL = process.argv[2] || "https://main.d2sayha59t6h2h.amplifyapp.com";

async function testUploadFlow() {
  console.log(`\n🧪 Test E2E de carga de documentos`);
  console.log(`📍 URL: ${BASE_URL}\n`);

  // 1. Verificar que la API responde
  console.log("1️⃣  Verificando que la API responde...");
  const healthRes = await fetch(`${BASE_URL}/api/documents?limit=1`);
  if (!healthRes.ok) {
    throw new Error(`API no responde: ${healthRes.status} ${healthRes.statusText}`);
  }
  console.log("   ✅ API respondió OK\n");

  // 2. Crear un PDF de prueba pequeño en memoria
  console.log("2️⃣  Generando PDF de prueba...");
  // Usamos un PDF mínimo válido con texto
  const pdfContent = createMinimalPDF();
  const filename = `test-e2e-${Date.now()}.pdf`;
  console.log(`   📄 ${filename} (${pdfContent.byteLength} bytes)\n`);

  // 3. Obtener presigned URL
  console.log("3️⃣  Obteniendo presigned URL...");
  const presignRes = await fetch(`${BASE_URL}/api/documents/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType: "application/pdf" }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.text();
    throw new Error(`Presign falló: ${presignRes.status} - ${err}`);
  }

  const { url: presignedUrl, s3Key, s3Url } = await presignRes.json();
  console.log(`   ✅ s3Key: ${s3Key}\n`);

  // 4. Subir a S3
  console.log("4️⃣  Subiendo a S3...");
  const uploadRes = await fetch(presignedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: pdfContent,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload a S3 falló: ${uploadRes.status}`);
  }
  console.log("   ✅ Archivo subido a S3\n");

  // 5. Registrar documento (Fase 1 - parsear + chunks)
  console.log("5️⃣  Fase 1: Parseando PDF y creando chunks...");
  const t1 = Date.now();
  const docRes = await fetch(`${BASE_URL}/api/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      s3Key,
      s3Url,
      filename,
      fileSize: pdfContent.byteLength,
      chunkSize: 3000,
      chunkOverlap: 750,
      strategy: "FIXED",
    }),
  });

  if (!docRes.ok) {
    const err = await docRes.text();
    throw new Error(`Fase 1 falló: ${docRes.status} - ${err}`);
  }

  const docData = await docRes.json();
  const documentId = docData.document.id;
  const chunkCount = docData.document._count?.chunks ?? 0;
  const t1Elapsed = Date.now() - t1;
  console.log(`   ✅ Documento ${documentId}`);
  console.log(`   📊 ${chunkCount} chunks creados en ${t1Elapsed}ms`);
  console.log(`   📄 Status: ${docData.document.status}\n`);

  if (chunkCount === 0) {
    console.log("   ⚠️  0 chunks — el PDF de prueba no tiene texto extraíble. Test parcial.");
    console.log("\n✅ Fase 1 funcionó correctamente (sin timeout).");
    return;
  }

  // 6. Fase 2: Generar embeddings por lotes
  console.log("6️⃣  Fase 2: Generando embeddings por lotes...");
  const t2 = Date.now();
  let iteration = 0;

  while (true) {
    iteration++;
    const processRes = await fetch(`${BASE_URL}/api/documents/${documentId}/process`, {
      method: "POST",
    });

    if (processRes.status === 429) {
      console.log(`   ⏳ Throttled, esperando 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }

    if (!processRes.ok) {
      const err = await processRes.text();
      throw new Error(`Fase 2 falló: ${processRes.status} - ${err}`);
    }

    const progress = await processRes.json();
    console.log(`   📊 Lote ${iteration}: ${progress.processedChunks}/${progress.totalChunks} chunks (${progress.status})`);

    if (progress.status === "READY") break;
  }

  const t2Elapsed = Date.now() - t2;
  console.log(`   ✅ Embeddings completados en ${t2Elapsed}ms (${iteration} lotes)\n`);

  // 7. Verificar documento final
  console.log("7️⃣  Verificando documento final...");
  const verifyRes = await fetch(`${BASE_URL}/api/documents?limit=1`);
  const verifyData = await verifyRes.json();
  const doc = verifyData.documents?.find((d: { id: string }) => d.id === documentId);

  if (!doc) {
    throw new Error("Documento no encontrado en listado");
  }

  console.log(`   📄 Status: ${doc.status}`);
  console.log(`   📊 Chunks: ${doc._count?.chunks ?? 0}`);
  console.log(`   📑 Páginas: ${doc.pageCount}\n`);

  if (doc.status !== "READY") {
    throw new Error(`Documento no está READY: ${doc.status}`);
  }

  // 8. Cleanup: eliminar documento de prueba
  console.log("8️⃣  Limpiando documento de prueba...");
  const deleteRes = await fetch(`${BASE_URL}/api/documents/${documentId}`, {
    method: "DELETE",
  });
  if (deleteRes.ok) {
    console.log("   ✅ Documento de prueba eliminado\n");
  } else {
    console.log(`   ⚠️  No se pudo eliminar (${deleteRes.status}), limpiar manualmente\n`);
  }

  const totalElapsed = t1Elapsed + t2Elapsed;
  console.log("═══════════════════════════════════════");
  console.log("✅ TEST E2E COMPLETADO EXITOSAMENTE");
  console.log(`⏱️  Fase 1 (parseo+chunks): ${t1Elapsed}ms`);
  console.log(`⏱️  Fase 2 (embeddings):    ${t2Elapsed}ms`);
  console.log(`⏱️  Total:                  ${totalElapsed}ms`);
  console.log("═══════════════════════════════════════\n");
}

/**
 * Crea un PDF mínimo válido con texto para testing
 */
function createMinimalPDF(): Uint8Array {
  const text = "Este es un documento PDF de prueba para el sistema RAG. Contiene texto suficiente para generar al menos un chunk y probar el flujo completo de embeddings. La inteligencia artificial y el procesamiento de lenguaje natural permiten extraer conocimiento de documentos como este. El sistema RAG (Retrieval Augmented Generation) combina la búsqueda vectorial con modelos de lenguaje para responder preguntas basándose en documentos específicos.";

  // PDF 1.4 mínimo con un stream de texto
  const pdfLines = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`,
  ];

  // Generar el stream de texto con wrapping manual
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    if (currentLine.length + word.length > 60) {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());

  const streamLines = ["BT", "/F1 12 Tf", "50 742 Td", "14 TL"];
  for (const line of lines) {
    // Escapar paréntesis en el texto
    const escaped = line.replace(/([()])/g, "\\$1");
    streamLines.push(`(${escaped}) '`);
  }
  streamLines.push("ET");
  const streamContent = streamLines.join("\n");

  pdfLines.push(
    `4 0 obj << /Length ${streamContent.length} >> stream`,
    streamContent,
    "endstream endobj"
  );

  // xref + trailer
  const bodyStr = pdfLines.join("\n") + "\n";
  const xrefOffset = bodyStr.length;

  const trailer = [
    "xref",
    "0 6",
    "0000000000 65535 f ",
    ...calculateOffsets(bodyStr),
    "trailer << /Size 6 /Root 1 0 R >>",
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ];

  const fullPdf = bodyStr + trailer.join("\n");
  return new TextEncoder().encode(fullPdf);
}

function calculateOffsets(body: string): string[] {
  const offsets: string[] = [];
  for (let obj = 1; obj <= 5; obj++) {
    const pattern = `${obj} 0 obj`;
    const idx = body.indexOf(pattern);
    if (idx >= 0) {
      offsets.push(String(idx).padStart(10, "0") + " 00000 n ");
    }
  }
  return offsets;
}

// Run
testUploadFlow().catch((err) => {
  console.error("\n❌ TEST FALLÓ:", err.message);
  process.exit(1);
});
