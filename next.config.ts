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
  },
};

export default nextConfig;
