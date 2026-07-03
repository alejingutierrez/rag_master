/**
 * Identidad y URL base del sitio público. Server-side (NO `NEXT_PUBLIC_`): se lee
 * en `generateMetadata`, `sitemap.ts` y `robots.ts`, todo en el servidor, así que
 * un env de runtime basta (no requiere inlining en build).
 *
 * El default apunta al dominio real (historiacolombiana.com) para no requerir
 * setup de secretos; override con `SITE_URL` en App Runner si cambia el dominio.
 */

export const SITE_URL = (process.env.SITE_URL || "https://historiacolombiana.com").replace(
  /\/+$/,
  "",
);

/** Nombre editorial del sitio (sufijo de títulos, siteName de OG, publisher). */
export const SITE_NAME = "Historia Colombiana";

/** Autor de todo output publicado (nunca el id del modelo). */
export const AUTHOR = "Alejandro Gutiérrez";

/** OG de respaldo para piezas sin portada propia. Resuelto contra metadataBase. */
export const DEFAULT_OG_IMAGE = "/og-default.png";

/** Une un path relativo al dominio del sitio. `absUrl("/hechos/x")`. Idempotente con URLs absolutas. */
export function absUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
