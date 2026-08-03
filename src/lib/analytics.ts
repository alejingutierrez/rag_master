/** Google Tag Manager — eventos editoriales publicados en `dataLayer`. */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Publica un evento para GTM. La cola se crea incluso antes de que descargue el
 * contenedor, así ninguna vista editorial se pierde por una carrera de carga.
 */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem("hc_analytics_consent_v1") !== "granted") return;
  } catch {
    return;
  }
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ ...(params ?? {}), event: name });
}
