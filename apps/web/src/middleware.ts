import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  deriveAccessCookieToken,
  getAccessCode,
  isAccessGranted,
} from "./lib/access";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/login" ||
    pathname === "/bank/callback" ||
    pathname.startsWith("/api/auth/verify") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (!getAccessCode()) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "missing_access_code");
    return NextResponse.redirect(loginUrl);
  }

  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (await isAccessGranted(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("from", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
