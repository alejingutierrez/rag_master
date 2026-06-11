import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
