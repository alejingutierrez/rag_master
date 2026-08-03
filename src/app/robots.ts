import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/site";

export function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Las portadas públicas se sirven desde este endpoint; bloquear todo
        // `/api` impedía a Google Images rastrearlas.
        allow: ["/", "/api/public-image/"],
        disallow: ["/api/"],
      },
    ],
    sitemap: absUrl("/sitemap.xml"),
  };
}

export default robots;
