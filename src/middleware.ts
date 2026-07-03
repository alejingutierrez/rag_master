import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth-edge";

/**
 * Candado de producción — SEPARA público de admin.
 *
 * Público (lectura): `/`, `/archivo`, `/ensayos`, `/login`, y los prefijos de
 * secciones públicas. TODO lo demás — `/admin/*` y el resto de `/api/*` — exige
 * autenticación.
 *
 * Autenticación (en orden):
 *   1) Cookie de sesión `hc_session` (JWT HS256 firmado con AUTH_SECRET) —
 *      el login real de humanos. Se verifica aquí con `jose` (Edge-safe).
 *   2) Bearer/Basic `ADMIN_ACCESS_TOKEN` — fallback para clientes automáticos
 *      (el smoke test post-deploy). NO se elimina para no romper el deploy.
 *
 * Fail-closed: si NO hay ni `AUTH_SECRET` ni `ADMIN_ACCESS_TOKEN`, el admin
 * queda BLOQUEADO (503). En producción ambos van como secretos → env de App Runner.
 *
 * Edge runtime: este archivo SOLO puede importar `jose` (vía auth-edge). Nada de
 * bcrypt ni Prisma aquí.
 */

const PUBLIC_PAGE_PREFIXES = [
  "/archivo",
  "/ensayos",
  "/epocas",
  "/entidades",
  "/preguntas",
  "/hechos",
  "/linea-de-tiempo",
  "/acerca",
  "/colecciones",
];

const PUBLIC_API = new Set([
  "/api/health",
  "/api/login",
  "/api/logout",
]);

// Prefijos de API públicos (streaming de imágenes de piezas publicadas).
const PUBLIC_API_PREFIXES = ["/api/public-image/"];

function isPublicPage(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login") return true;
  return PUBLIC_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function isPublicApi(pathname: string): boolean {
  if (PUBLIC_API.has(pathname)) return true;
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Fallback de token compartido (smoke test / clientes automáticos). */
function tokenAuthorized(req: NextRequest, expected: string | undefined): boolean {
  if (!expected) return false;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "");
  if (bearer && bearer === expected) return true;
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const pass = decoded.slice(decoded.indexOf(":") + 1);
      if (pass === expected) return true;
    } catch {
      /* header malformado → no autorizado */
    }
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Superficie pública de lectura → pasa sin candado.
  if (isPublicPage(pathname) || isPublicApi(pathname)) {
    return NextResponse.next();
  }

  const token = process.env.ADMIN_ACCESS_TOKEN;
  const authSecret = process.env.AUTH_SECRET;

  // Fail-closed: sin ningún mecanismo configurado, el admin no existe.
  if (!token && !authSecret) {
    return new NextResponse(
      "Admin bloqueado: falta AUTH_SECRET / ADMIN_ACCESS_TOKEN en el entorno.",
      { status: 503 },
    );
  }

  // 1) Sesión de cookie (login humano).
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  // 2) Token compartido (smoke test / automatización).
  const authed = Boolean(session) || tokenAuthorized(req, token);

  if (authed) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  // No autenticado.
  if (pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Páginas HTML del admin → al formulario de login (con retorno).
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  const res = NextResponse.redirect(loginUrl);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // Corre en todo salvo assets estáticos y archivos con extensión (svg/png/…, robots.txt, etc.).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?|json)$).*)",
  ],
};
