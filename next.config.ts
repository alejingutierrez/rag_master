import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // El sitio público prioriza un <head> completo y determinista. Algunos
  // auditores usan un UA móvil genérico (sin `Chrome-Lighthouse`) y pueden
  // capturar la página antes de que Next inserte la metadata transmitida.
  // Bloquear el streaming evita falsos faltantes de title/description/canonical
  // y da el mismo contrato inicial a buscadores, previews y navegadores.
  htmlLimitedBots: /.*/,
  // Bundling: pdf-parse (Node) + pdfkit (Node con fonts/binarios) deben ir externos
  serverExternalPackages: ["pdf-parse", "pdfkit"],
  outputFileTracingIncludes: {
    "/api/documents": [
      "./node_modules/pdf-parse/**/*",
    ],
    "/api/deliverables": [
      "./node_modules/pdfkit/**/*",
    ],
    // Eventos minados de la línea de tiempo: el route handler los lee de disco
    // en runtime y el build standalone no los detecta solo.
    "/api/timeline/events": [
      "./src/data/**/*",
    ],
  },
};

export default nextConfig;
