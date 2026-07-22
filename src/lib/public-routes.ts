/**
 * Prefijos de rutas del sitio PÚBLICO — una sola fuente de verdad.
 *
 * La usan el middleware (candado de auth: público = sin login) y el AppShell
 * (chrome: público = sin sidebar del admin). Tenerla en un solo lugar evita el
 * drift que dejaba páginas nuevas con el shell del admin. Módulo puro y
 * edge-safe (sin imports) para poder usarse en el middleware.
 */
export const PUBLIC_PAGE_PREFIXES = [
  "/archivo",
  "/ensayos",
  "/epocas",
  "/entidades",
  "/personas",
  "/lugares",
  "/ideas",
  "/preguntas",
  "/hechos",
  "/linea-de-tiempo",
  "/mapa",
  "/buscar",
  "/acerca",
  "/autor",
  "/como-trabajamos",
  "/fuentes",
  "/criterios-editoriales",
  "/colecciones",
];

/** true si el path pertenece a la superficie pública de lectura (incluye `/` y `/login`). */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login") return true;
  return PUBLIC_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
