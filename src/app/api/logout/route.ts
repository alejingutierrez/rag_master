import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-edge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/logout — borra la cookie de sesión. Pública (idempotente). */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
