"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";

/** Rutas privadas que NO se miden (panel + login). */
const isPrivate = (p: string) => p.startsWith("/admin") || p.startsWith("/login");

/** Emite page_view en cada navegación client-side (SPA), salvo en rutas privadas. */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (isPrivate(pathname) || typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }
    const qs = searchParams?.toString();
    window.gtag("event", "page_view", {
      page_path: qs ? `${pathname}?${qs}` : pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, searchParams]);
  return null;
}

/**
 * Google Analytics 4 (gtag.js). Carga sólo en el sitio público: si el primer
 * render es una ruta privada no inyecta nada; una vez cargado en una ruta pública,
 * persiste. `send_page_view:false` → los page_view los emite PageviewTracker, que
 * también cubre las navegaciones SPA (Next no dispara page_view por sí solo).
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const loaded = useRef(false);
  if (!isPrivate(pathname)) loaded.current = true;
  if (!loaded.current) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:false});`}
      </Script>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
    </>
  );
}
