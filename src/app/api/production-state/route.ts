import { NextRequest, NextResponse } from "next/server";
import { getProducedKeys, producedMapToObject } from "@/lib/production-state";
import { isSourceKind } from "@/lib/source-ref";

export const dynamic = "force-dynamic";

/**
 * GET /api/production-state?kind=hecho[&keys=a,b,c]
 *
 * Devuelve qué ítems de una tipología ya fueron producidos como su ficha:
 *   { kind, produced: { [key]: { deliverableId, publishedAt } } }
 *
 * Lo consumen las superficies del admin (badges) y el panel de producción en
 * serie. `keys` es opcional: filtra a un subconjunto para catálogos grandes.
 */
export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  if (!isSourceKind(kind)) {
    return NextResponse.json(
      { error: "kind inválido (pregunta | pregunta-madre | hecho | entidad | epoca)" },
      { status: 400 },
    );
  }

  const keysParam = req.nextUrl.searchParams.get("keys");
  const keys = keysParam
    ? keysParam.split(",").map((k) => k.trim()).filter(Boolean)
    : undefined;

  try {
    const map = await getProducedKeys(kind, keys);
    return NextResponse.json({ kind, produced: producedMapToObject(map) });
  } catch (error) {
    console.error("Error fetching production state:", error);
    return NextResponse.json({ error: "Error al obtener el estado de producción" }, { status: 500 });
  }
}
