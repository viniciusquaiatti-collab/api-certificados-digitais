import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  console.log("🛡️ [MIDDLEWARE] Interceptando rota...");

  const token = request.cookies.get("token")?.value;

  console.log("🍪 [MIDDLEWARE] Token cookie:", token);

  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register");

  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");

  // =============================
  // SEM TOKEN
  // =============================
  if (!token && isDashboard) {
    console.warn("❌ [MIDDLEWARE] Acesso negado → dashboard sem token");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // =============================
  // COM TOKEN → BLOQUEIA LOGIN/REGISTER
  // =============================
  if (token && isAuthPage) {
    console.log("🔁 [MIDDLEWARE] Usuário já logado → dashboard");
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  console.log("✅ [MIDDLEWARE] Acesso permitido");

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};