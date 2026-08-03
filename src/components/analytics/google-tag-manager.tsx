"use client";

import Script from "next/script";

/**
 * Contenedor único de Google Tag Manager.
 *
 * GA4 se configura dentro de GTM; no se carga `gtag.js` por separado para no
 * duplicar `page_view`. La medición mejorada de GA4 ya cubre los cambios de
 * historial de Next.js y los eventos editoriales entran por `dataLayer`.
 */
export function GoogleTagManager({ containerId }: { containerId?: string }) {
  if (!containerId || !/^GTM-[A-Z0-9]+$/.test(containerId)) {
    return null;
  }

  return (
    <Script id="gtm-loader" strategy="afterInteractive">
      {`window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};window.gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});window.gtag('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});(function(w,d,s,l,i){w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${containerId}');`}
    </Script>
  );
}
