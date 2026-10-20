import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideAccess } from "@/lib/access";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

/**
 * Primera barrera de acceso (Next.js 16 renombró middleware.ts → proxy.ts).
 * Las páginas y las Server Actions vuelven a verificar la sesión.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const expired = token !== undefined && session === null;
  const decision = decideAccess(request.nextUrl.pathname, session, expired);

  if (decision.type === "redirect") {
    const response = NextResponse.redirect(new URL(decision.to, request.url));
    if (expired) {
      response.cookies.delete(SESSION_COOKIE);
    }
    return response;
  }

  if (decision.type === "forbidden") {
    return NextResponse.rewrite(new URL("/acceso-denegado", request.url), { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/mi-cuenta", "/mi-cuenta/:path*"],
};
