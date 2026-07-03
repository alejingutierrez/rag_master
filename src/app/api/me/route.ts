import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth-edge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me — identidad de la sesión actual (para mostrar "sesión: … · Salir"
 * en el admin). Ruta gateada: solo responde con sesión válida. La cookie es
 * httpOnly, así que el cliente no puede leerla directamente.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, email: session.sub, role: session.role });
}
