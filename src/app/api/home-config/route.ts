import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth-edge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/home-config — config actual del home (para el editor). Gateado.
export async function GET() {
  try {
    const row = await prisma.homeConfig.findUnique({ where: { id: "default" } });
    return NextResponse.json(
      row ?? { hero: {}, featured: [], collection: {}, questionOfWeek: {} },
    );
  } catch (error) {
    console.error("Error fetching home-config:", error);
    return NextResponse.json({ error: "Error al leer la configuración" }, { status: 500 });
  }
}

function asStringArray(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, max);
}

// PATCH /api/home-config — guarda los bloques del home. Gateado.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    const editor = session?.sub ?? "admin";

    // Normaliza los bloques que vengan (parcial).
    const data: Record<string, unknown> = { updatedBy: editor };

    if (body.hero !== undefined) {
      const id = typeof body.hero?.deliverableId === "string" ? body.hero.deliverableId : "";
      data.hero = id ? { deliverableId: id } : {};
    }
    if (body.featured !== undefined) {
      data.featured = asStringArray(body.featured, 6);
    }
    if (body.collection !== undefined) {
      data.collection = {
        title: typeof body.collection?.title === "string" ? body.collection.title.slice(0, 120) : "",
        subtitle:
          typeof body.collection?.subtitle === "string" ? body.collection.subtitle.slice(0, 200) : "",
        items: asStringArray(body.collection?.items, 6),
      };
    }
    if (body.questionOfWeek !== undefined) {
      const q = body.questionOfWeek ?? {};
      data.questionOfWeek =
        typeof q.deliverableId === "string" && q.deliverableId
          ? { deliverableId: q.deliverableId }
          : {
              title: typeof q.title === "string" ? q.title.slice(0, 200) : "",
              answer: typeof q.answer === "string" ? q.answer.slice(0, 600) : "",
              href: typeof q.href === "string" ? q.href.slice(0, 200) : "",
            };
    }

    const saved = await prisma.homeConfig.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...data },
    });

    return NextResponse.json({ success: true, config: saved });
  } catch (error) {
    console.error("Error saving home-config:", error);
    return NextResponse.json({ error: "Error al guardar la configuración" }, { status: 500 });
  }
}
