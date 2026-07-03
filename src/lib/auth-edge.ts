/**
 * Auth — mitad EDGE-safe. SOLO depende de `jose` (Web Crypto). La importa el
 * middleware, que corre en el runtime Edge y NO puede cargar bcrypt ni Prisma.
 *
 * Aquí vive únicamente la verificación de la firma del JWT de sesión y la
 * constante del nombre de la cookie. El hashing de contraseña (bcrypt) y la
 * firma viven en `auth.ts` (Node), importado solo por rutas API `runtime=nodejs`.
 */
import { jwtVerify } from "jose";

export const SESSION_COOKIE = "hc_session";

export interface SessionPayload {
  /** Email (o usuario) del admin autenticado. */
  sub: string;
  role: string;
}

function secretKey(): Uint8Array | null {
  const s = process.env.AUTH_SECRET;
  if (!s) return null;
  return new TextEncoder().encode(s);
}

/**
 * Verifica un token de sesión. Devuelve el payload si la firma y la expiración
 * son válidas; null en cualquier otro caso (token ausente, alterado o vencido).
 * Nunca lanza — apta para el hot-path del middleware.
 */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  const key = secretKey();
  if (!key || !token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return { sub: payload.sub, role: typeof payload.role === "string" ? payload.role : "admin" };
  } catch {
    return null;
  }
}
