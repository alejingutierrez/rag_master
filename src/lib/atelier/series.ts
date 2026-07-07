import type { LongitudId } from "../atelier-formats";

export const SERIES_DEFAULT_LONGITUD: LongitudId = "extensa";
export const SERIES_REQUIRE_IMAGE = true;
export const SERIES_IMAGE_MAX_RETRIES = 1;
export const SERIES_CATALOG_PAGE_SIZE = 100;
export const SERIES_HIDE_PRODUCED_DEFAULT = true;

export type SeriesEntityType = "person" | "place" | "concept";

export const ENTITY_SERIES_TABS: ReadonlyArray<{
  type: SeriesEntityType;
  label: string;
}> = [
  { type: "person", label: "Personas" },
  { type: "place", label: "Lugares" },
  { type: "concept", label: "Conceptos" },
];

export function buildSeriesEntityCatalogUrl(type: SeriesEntityType): string {
  const params = new URLSearchParams({
    limit: "all",
    minMentions: "2",
    type,
  });
  return `/api/entities?${params.toString()}`;
}

export function buildSeriesCatalogPageUrl(
  base: string,
  page: number,
  limit = SERIES_CATALOG_PAGE_SIZE,
): string {
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}page=${page}&limit=${limit}`;
}

export function shouldFetchSeriesCatalogPage(page: number, totalPages: number): boolean {
  return page <= totalPages;
}

export type SeriesPollAction =
  | { kind: "wait"; reason: "production-running" | "image-running" | "image-kickoff-running" }
  | { kind: "trigger-image"; reason: "image-missing" | "image-error" }
  | { kind: "done" }
  | { kind: "error"; reason: "production-error" | "image-error" };

interface SeriesPollDeliverable {
  status?: string | null;
  metadata?: unknown;
  imageUrl?: string | null;
  imageKey?: string | null;
}

interface SeriesPollOptions {
  requireImage?: boolean;
  imageRetries?: number;
  imageKickoffStarted?: boolean;
}

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
}

function imageStatus(metadata: unknown): string | null {
  const image = metadataRecord(metadata).image;
  if (!image || typeof image !== "object") return null;
  const status = (image as Record<string, unknown>).status;
  return typeof status === "string" ? status : null;
}

export function evaluateSeriesPoll(
  deliverable: SeriesPollDeliverable,
  opts: SeriesPollOptions = {},
): SeriesPollAction {
  if (deliverable.status === "ERROR") return { kind: "error", reason: "production-error" };
  if (deliverable.status !== "COMPLETE") return { kind: "wait", reason: "production-running" };

  const requireImage = opts.requireImage ?? SERIES_REQUIRE_IMAGE;
  if (!requireImage) return { kind: "done" };

  if (deliverable.imageUrl || deliverable.imageKey) return { kind: "done" };

  const status = imageStatus(deliverable.metadata);
  if (status === "ok") return { kind: "done" };
  if (status === "generando") return { kind: "wait", reason: "image-running" };
  if (status === "error") {
    if ((opts.imageRetries ?? 0) < SERIES_IMAGE_MAX_RETRIES) {
      return { kind: "trigger-image", reason: "image-error" };
    }
    return { kind: "error", reason: "image-error" };
  }

  if (opts.imageKickoffStarted) return { kind: "wait", reason: "image-kickoff-running" };
  return { kind: "trigger-image", reason: "image-missing" };
}
