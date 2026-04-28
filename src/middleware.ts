import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_NAME = "auth-token";

const PROTECTED_PATHS = [
  "/dashboard",
  "/compras",
  "/ventas",
  "/detracciones",
  "/documentos",
  "/alertas",
  "/cuentas-cobrar",
  "/cuentas-pagar",
  "/reportes",
  "/ia",
  "/descargas",
  "/configuracion",
  "/sire",
  "/admin",
];

// Security headers applied to all responses
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // CSP — allow same-origin + inline styles (needed for Tailwind/shadcn)
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-eval in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_NAME)?.value;

  // Skip static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Always allow auth API routes, health check, and Railway readiness probe
  if (
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname === "/api/health" ||
    pathname === "/api/ready"
  ) {
    return addSecurityHeaders(NextResponse.next());
  }

  // If authenticated user tries to access /login → redirect to dashboard
  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protected API routes: require cookie
  if (pathname.startsWith("/api/")) {
    if (!token) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // Protected page routes: require cookie
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
