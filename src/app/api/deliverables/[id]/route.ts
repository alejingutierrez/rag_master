import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncQuestionStats } from "@/lib/question-stats-sync";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth-edge";
import {
  normalizeStructured,
  slugify,
  type StructuredData,
  type TypologyKind,
} from "@/lib/typology-schemas";

export const runtime = "nodejs";

/** Garantiza un slug único entre lo PUBLICADO de la misma tipología. */
async function ensureUniqueSlug(
  base: string,
  typology: TypologyKind,
  selfId: string,
): Promise<string> {
  const root = slugify(base) || "pieza";
  let candidate = root;
  for (let i = 2; i < 200; i++) {
    const clash = await prisma.deliverable.findFirst({
      where: {
        id: { not: selfId },
        status: "COMPLETE",
        source: "atelier",
        publishedAt: { not: null },
        AND: [
          { structuredData: { path: ["typology"], equals: typology } },
          { structuredData: { path: ["slug"], equals: candidate } },
        ],
      },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${selfId.slice(0, 6)}`;
}

// GET /api/deliverables/[id] — Get single deliverable with full answer
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deliverable = await prisma.deliverable.findUnique({
      where: { id },
      include: {
        question: {
          select: {
            id: true,
            pregunta: true,
            periodoCode: true,
            periodoNombre: true,
            periodoRango: true,
            categoriaCode: true,
            categoriaNombre: true,
            subcategoriaCode: true,
            subcategoriaNombre: true,
            document: { select: { id: true, filename: true } },
          },
        },
      },
    });

    if (!deliverable) {
      return NextResponse.json(
        { error: "Entregable no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(deliverable);
  } catch (error) {
    console.error("Error fetching deliverable:", error);
    return NextResponse.json(
      { error: "Error al obtener entregable" },
      { status: 500 }
    );
  }
}

// PATCH /api/deliverables/[id] — curaduría: publicar/despublicar + editar ficha.
// Body: { published?: boolean, structuredData?: object, slug?: string }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const existing = await prisma.deliverable.findUnique({
      where: { id },
      select: { id: true, structuredData: true, publishedAt: true, source: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Entregable no encontrado" }, { status: 404 });
    }

    // Identidad del editor (para publishedBy).
    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    const editor = session?.sub ?? "admin";

    const data: Record<string, unknown> = {};

    // 1) Edición de la ficha estructurada (correcciones del extractor).
    let structured: StructuredData | null = normalizeStructured(existing.structuredData);
    if (body.structuredData !== undefined) {
      const next = normalizeStructured(body.structuredData);
      if (body.structuredData !== null && !next) {
        return NextResponse.json({ error: "structuredData inválida" }, { status: 400 });
      }
      structured = next;
      data.structuredData = next as unknown as object;
    }

    // 2) Slug manual (dentro de la ficha).
    if (typeof body.slug === "string" && structured) {
      structured = { ...structured, slug: slugify(body.slug) || structured.slug };
      data.structuredData = structured as unknown as object;
    }

    // 3) Publicar / despublicar.
    if (typeof body.published === "boolean") {
      if (body.published) {
        // Al publicar una pieza con ficha, garantiza slug único por tipología.
        if (structured) {
          const uniqueSlug = await ensureUniqueSlug(structured.slug, structured.typology, id);
          if (uniqueSlug !== structured.slug) {
            structured = { ...structured, slug: uniqueSlug };
            data.structuredData = structured as unknown as object;
          }
        }
        data.publishedAt = new Date();
        data.publishedBy = editor;
      } else {
        data.publishedAt = null;
      }
    }

    const updated = await prisma.deliverable.update({
      where: { id },
      data,
      select: {
        id: true,
        publishedAt: true,
        publishedBy: true,
        structuredData: true,
      },
    });

    return NextResponse.json({ success: true, deliverable: updated });
  } catch (error) {
    console.error("Error patching deliverable:", error);
    return NextResponse.json({ error: "Error al actualizar entregable" }, { status: 500 });
  }
}

// DELETE /api/deliverables/[id] — Delete single deliverable
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Necesitamos saber a qué pregunta pertenece ANTES de borrar para resincronizar.
    const existing = await prisma.deliverable.findUnique({
      where: { id },
      select: { questionId: true },
    });

    await prisma.deliverable.delete({ where: { id } });

    if (existing?.questionId) {
      try {
        await syncQuestionStats(existing.questionId);
      } catch (e) {
        console.warn(`[deliverables] syncQuestionStats failed for ${existing.questionId}:`, e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deliverable:", error);
    return NextResponse.json(
      { error: "Error al eliminar entregable" },
      { status: 500 }
    );
  }
}
