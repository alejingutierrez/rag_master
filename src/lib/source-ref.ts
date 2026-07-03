/**
 * SourceRef — el puente que interconecta un ítem del archivo (una pregunta, una
 * pregunta-madre, un hecho, una entidad, una época) con el entregable que el
 * Taller produce a partir de él.
 *
 * Se persiste dentro del JSONB existente `Deliverable.metadata.sourceRef` (⇒ sin
 * migración de esquema — la RDS de prod es de solo lectura). Un ítem queda
 * "producido" ⇔ existe un Deliverable COMPLETE cuyo `templateId` es la ficha de
 * su MISMO tipo (`fichaFormatForKind`) y cuyo `sourceRef.key` coincide.
 *
 * Módulo puro y sin dependencias de servidor: lo importan el cliente (Taller,
 * superficies del admin, panel en serie) y el servidor (rutas de producción y
 * el lector de estado). Reutiliza `slugify` de typology-schemas (también puro).
 */

import { slugify } from "@/lib/typology-schemas";
import type { AtelierFormatId } from "@/lib/atelier-formats";

export type SourceKind = "pregunta" | "pregunta-madre" | "hecho" | "entidad" | "epoca";

export const SOURCE_KINDS: readonly SourceKind[] = [
  "pregunta",
  "pregunta-madre",
  "hecho",
  "entidad",
  "epoca",
];

export interface SourceRef {
  kind: SourceKind;
  /** Identidad determinista del ítem, conocida antes de producir. */
  key: string;
  /** Texto legible para chips / enlaces. */
  label: string;
}

export function isSourceKind(v: unknown): v is SourceKind {
  return typeof v === "string" && (SOURCE_KINDS as readonly string[]).includes(v);
}

/**
 * Ficha del MISMO tipo que "marca como producido" a un ítem de este `kind`.
 * Una pregunta-madre se produce como ficha de pregunta (no hay ficha-madre en la
 * tipología pública: es una pregunta sintetizada).
 */
export function fichaFormatForKind(kind: SourceKind): AtelierFormatId {
  switch (kind) {
    case "hecho":
      return "ficha-hecho";
    case "epoca":
      return "ficha-epoca";
    case "entidad":
      return "ficha-entidad";
    case "pregunta":
    case "pregunta-madre":
      return "ficha-pregunta";
  }
}

/** Etiqueta legible del tipo (para "Producir como {tipo}", chips, badges). */
export function kindLabel(kind: SourceKind): string {
  switch (kind) {
    case "pregunta":
      return "pregunta";
    case "pregunta-madre":
      return "pregunta madre";
    case "hecho":
      return "hecho";
    case "entidad":
      return "entidad";
    case "epoca":
      return "época";
  }
}

// ── Constructores de llave determinista ──────────────────────────────────────
// La llave es estable y se conoce ANTES de producir (a diferencia del slug, que
// el LLM decide al final). Así el match ítem↔producción es exacto y robusto.

/** Hecho: evento del timeline. Usa el id minado si existe; si no, slug del título. */
export function hechoKey(periodoCode: string, event: { id?: string | null; titulo?: string | null }): string {
  const tail = (event.id && String(event.id).trim()) || slugify(event.titulo || "");
  return `${periodoCode}:${tail}`;
}

/** Entidad: tipo + nombre. Espeja la llave `tipo::nombre` de /api/entities. */
export function entidadKey(type: string, name: string): string {
  return `${type}:${slugify(name)}`;
}

/** Época: el código de período canónico (taxonomy) ya es único y estable. */
export function epocaKey(periodoCode: string): string {
  return periodoCode;
}

// ── Validación / (de)serialización para el querystring del Taller ─────────────

/** Valida un objeto crudo (body de API) a un SourceRef, o null. */
export function asSourceRef(raw: unknown): SourceRef | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isSourceKind(o.kind)) return null;
  const key = typeof o.key === "string" ? o.key.trim() : "";
  if (!key) return null;
  const label = typeof o.label === "string" ? o.label : "";
  return { kind: o.kind, key, label };
}

/** base64url UTF-8 safe, funciona en servidor (Buffer) y navegador (btoa). */
function toBase64Url(json: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(json, "utf8").toString("base64url");
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "base64url").toString("utf8");
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Codifica un SourceRef a un token opaco apto para ?sourceRef=. */
export function encodeSourceRef(ref: SourceRef): string {
  return toBase64Url(JSON.stringify(ref));
}

/** Decodifica el token de ?sourceRef= a un SourceRef válido, o null. */
export function decodeSourceRef(token: string | null | undefined): SourceRef | null {
  if (!token) return null;
  try {
    return asSourceRef(JSON.parse(fromBase64Url(token)));
  } catch {
    return null;
  }
}

/**
 * Construye la URL del Taller para producir un ítem con la ficha de su tipo,
 * llevando toda su metadata (intención + vínculo). Punto único de verdad para
 * los botones "Producir como {tipo}" de todas las superficies.
 */
export function atelierProduceHref(opts: {
  ref: SourceRef;
  intent: string;
  formatId?: AtelierFormatId;
}): string {
  const format = opts.formatId ?? fichaFormatForKind(opts.ref.kind);
  const p = new URLSearchParams({
    formatId: format,
    intent: opts.intent,
    sourceRef: encodeSourceRef(opts.ref),
  });
  return `/admin/atelier?${p.toString()}`;
}
