import { NextRequest, NextResponse } from "next/server";
import {
  adminEmail,
  isAuthConfigured,
  signSession,
  verifyPassword,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/auth";

// Node: bcrypt no corre en Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/login — intercambia email+contraseña por una cookie de sesión
 * httpOnly firmada (JWT HS256). Ruta pública (el candado la exceptúa) para que
 * un usuario sin sesión pueda autenticarse.
 */
export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "El login no está configurado en el servidor." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  // Siempre corre bcrypt (aunque el email no coincida) para no filtrar por
  // temporización cuál de los dos falló.
  const hash = process.env.ADMIN_PASSWORD_HASH ?? "";
  const passOk = await verifyPassword(password, hash);
  const emailOk = email.length > 0 && email === adminEmail();

  if (!emailOk || !passOk) {
    return NextResponse.json({ error: "Credenciales inválidas." }, { status: 401 });
  }

  const token = await signSession({ sub: adminEmail(), role: "admin" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
