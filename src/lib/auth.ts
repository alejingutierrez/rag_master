/**
 * Auth — mitad NODE. Depende de bcrypt (verificación de contraseña) y de `jose`
 * (firma del JWT). La importan SOLO rutas API con `runtime = "nodejs"`
 * (/api/login, /api/logout, /api/me). NUNCA el middleware (Edge).
 *
 * Modelo de identidad: un único admin definido por variables de entorno
 * (ADMIN_EMAIL + ADMIN_PASSWORD_HASH). No hay tabla `users` — la BD de prod es
 * de solo lectura y no queremos un write de seed. Ampliable a multi-usuario
 * después sin tocar el middleware.
 */
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { SESSION_COOKIE, type SessionPayload } from "./auth-edge";

export { SESSION_COOKIE };
export type { SessionPayload };

/** Vida de la sesión: 30 días. La cookie y el JWT comparten este TTL. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/** ¿Está el login configurado en el servidor? (fail-closed si no). */
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET &&
      process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD_HASH,
  );
}

export function adminEmail(): string {
  return (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
}

/** Compara la contraseña en claro contra el hash bcrypt del entorno. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/** Firma un JWT HS256 de sesión con AUTH_SECRET. */
export async function signSession(payload: SessionPayload): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no configurado");
  const key = new TextEncoder().encode(secret);
  return await new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key);
}
