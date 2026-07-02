import { NextRequest, NextResponse } from "next/server";

/**
 * Candado de producción — SEPARA público de admin.
 *
 * Público (lectura): `/`, `/archivo`, `/ensayos`, y los prefijos de secciones
 * públicas. TODO lo demás — `/admin/*` y el resto de `/api/*` — exige el token.
 *
 * Fail-closed: si `ADMIN_ACCESS_TOKEN` no está seteado, el admin queda BLOQUEADO
 * (503), nunca expuesto. En producción el token va como secreto → env de App Runner.
 *
 * Gate mínimo (Basic para el navegador + Bearer para clientes/smoke). Ampliable a
 * NextAuth después sin tocar las superficies públicas.
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

const PUBLIC_API = new Set(["/api/health"]);

function isPublicPage(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function authorized(req: NextRequest, expected: string): boolean {
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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Superficie pública de lectura → pasa sin candado.
  if (isPublicPage(pathname) || PUBLIC_API.has(pathname)) {
    return NextResponse.next();
  }

  const expected = process.env.ADMIN_ACCESS_TOKEN;
  if (!expected) {
    return new NextResponse(
      "Admin bloqueado: falta ADMIN_ACCESS_TOKEN en el entorno.",
      { status: 503 },
    );
  }

  if (authorized(req, expected)) {
    // Que Google no indexe el admin aunque quedara accesible.
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  if (pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return new NextResponse("Autenticación requerida.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Archivo · admin", charset="UTF-8"',
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export const config = {
  // Corre en todo salvo assets estáticos y archivos con extensión (svg/png/…, robots.txt, etc.).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?|json)$).*)",
  ],
};
