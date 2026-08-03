"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { GoogleTagManager } from "./google-tag-manager";
import "./analytics-consent.css";

export const ANALYTICS_CONSENT_KEY = "hc_analytics_consent_v1";
type Decision = "unknown" | "granted" | "denied";

const isPrivate = (pathname: string) =>
  pathname.startsWith("/admin") || pathname.startsWith("/login");

function readDecision(): Decision {
  if (typeof window === "undefined") return "unknown";
  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return stored === "granted" || stored === "denied" ? stored : "unknown";
  } catch {
    return "unknown";
  }
}

function subscribeToConsent(): () => void {
  // La elección propia recarga la página; no hay una fuente externa continua
  // que suscribir. `useSyncExternalStore` mantiene coherente el snapshot SSR.
  return () => undefined;
}

/**
 * Consentimiento básico: GTM no se descarga ni transmite datos antes de una
 * aceptación explícita. La preferencia queda en localStorage y se puede cambiar.
 */
export function AnalyticsConsent({ containerId }: { containerId?: string }) {
  const pathname = usePathname();
  const decision = useSyncExternalStore(subscribeToConsent, readDecision, () => "unknown");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [storageError, setStorageError] = useState(false);

  if (isPrivate(pathname)) return null;

  const choose = (next: Exclude<Decision, "unknown">) => {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_KEY, next);
    } catch {
      // Sin persistencia fiable no se activa medición.
      setStorageError(true);
      return;
    }
    // Recargar asegura que los eventos de la vista actual nazcan después del
    // consentimiento y que una revocación descargue por completo GTM.
    window.location.reload();
  };

  const open = decision === "unknown" || preferencesOpen;

  return (
    <>
      {decision === "granted" ? <GoogleTagManager containerId={containerId} /> : null}

      {open ? (
        <section className="ac-banner" aria-labelledby="ac-title">
          <div>
            <span className="ac-kicker">Privacidad y medición</span>
            <h2 id="ac-title">¿Nos permite medir el uso del archivo?</h2>
            <p>
              Usamos Google Analytics para conocer, de forma agregada, qué páginas se leen y
              mejorar la navegación. Google Tag Manager no se carga hasta que usted lo acepte.
              Puede rechazarlo o cambiar su decisión después. <Link href="/privacidad">Más información sobre privacidad y analítica</Link>.
            </p>
            {storageError ? (
              <p role="alert">El navegador bloqueó el almacenamiento local; la analítica seguirá desactivada.</p>
            ) : null}
          </div>
          <div className="ac-actions">
            <button type="button" className="ac-button ac-button-primary" onClick={() => choose("granted")}>
              Aceptar analítica
            </button>
            <button type="button" className="ac-button" onClick={() => choose("denied")}>
              Rechazar
            </button>
            {decision !== "unknown" ? (
              <button type="button" className="ac-close" onClick={() => setPreferencesOpen(false)}>
                Cerrar sin cambios
              </button>
            ) : null}
          </div>
        </section>
      ) : (
        <button type="button" className="ac-manage" onClick={() => setPreferencesOpen(true)}>
          Privacidad
        </button>
      )}
    </>
  );
}
