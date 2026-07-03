import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/site";
import { getSitemapEntries } from "@/lib/public-data";

// Dinámico: lee las piezas publicadas en vivo, así publicar aparece de inmediato.
export const dynamic = "force-dynamic";

type ChangeFreq = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

const STATIC_ROUTES: { path: string; changeFrequency: ChangeFreq; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/archivo", changeFrequency: "daily", priority: 0.8 },
  { path: "/hechos", changeFrequency: "weekly", priority: 0.7 },
  { path: "/epocas", changeFrequency: "weekly", priority: 0.7 },
  { path: "/entidades", changeFrequency: "weekly", priority: 0.7 },
  { path: "/preguntas", changeFrequency: "weekly", priority: 0.7 },
  { path: "/linea-de-tiempo", changeFrequency: "monthly", priority: 0.5 },
  { path: "/acerca", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: absUrl(r.path),
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const pieces = await getSitemapEntries();
  const pieceEntries: MetadataRoute.Sitemap = pieces.map((e) => ({
    url: absUrl(e.path),
    lastModified: e.lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...pieceEntries];
}
