/**
 * Anchos de portada. Las portadas se guardan como PNG de varios megabytes; el
 * endpoint `/api/public-image/[id]` las redimensiona y las convierte a AVIF/WebP,
 * pero solo si se le pide un ancho. Este helper lo añade en el punto de uso, para
 * que una miniatura de rejilla no descargue la imagen de portada completa.
 *
 * Los valores deben coincidir con los escalones del endpoint: cualquier otro se
 * redondea hacia arriba, así que pedir un ancho no soportado no rompe nada, solo
 * entrega algo más grande de lo necesario.
 */
export type ImageWidth = 160 | 320 | 480 | 640 | 960 | 1400;

/** Añade `?w=` (o `&w=`) a la URL de una portada. Tolera null e ignora URLs externas. */
export function imageAt(url: string | null | undefined, width: ImageWidth): string | null {
  if (!url) return null;
  // Solo nuestro endpoint sabe redimensionar; una URL externa se deja intacta.
  if (!url.startsWith("/api/public-image/")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}w=${width}`;
}
