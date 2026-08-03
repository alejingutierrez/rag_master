"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Evento GTM `view_content` al abrir una pieza publicada (hecho/época/entidad/
 * pregunta/ensayo). GTM lo remite a GA4 con sus parámetros editoriales.
 */
export function TrackView({
  contentType,
  itemId,
  itemName,
}: {
  contentType: string;
  itemId: string;
  itemName: string;
}) {
  useEffect(() => {
    trackEvent("view_content", {
      content_type: contentType,
      item_id: itemId,
      item_name: itemName,
    });
  }, [contentType, itemId, itemName]);
  return null;
}
