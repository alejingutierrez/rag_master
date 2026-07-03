/**
 * Google Analytics 4 — helpers de cliente. El tag (gtag.js) lo inyecta el
 * componente <GoogleAnalytics/> SOLO en el sitio público (no en /admin ni /login),
 * así la analítica no se contamina con el uso del panel.
 */
export const GA_MEASUREMENT_ID = "G-ESBTWH8XFB";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Envía un evento personalizado a GA4. No-op si gtag aún no cargó (el layout lo
 * inicializa antes de que monten las páginas de detalle) o en rutas privadas.
 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params ?? {});
}
