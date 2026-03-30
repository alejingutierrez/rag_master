import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse"],
  outputFileTracingIncludes: {
    "/api/documents": [
      "./node_modules/pdf-parse/**/*",
    ],
  },
};

export default nextConfig;
