/** Orígenes editoriales que pueden alimentar el sitio público. */
export const PUBLIC_DELIVERABLE_SOURCES = ["atelier", "master"] as const;

export function isPublicDeliverableSource(source: string): boolean {
  return (PUBLIC_DELIVERABLE_SOURCES as readonly string[]).includes(source);
}
