import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/** Segments suivant le préfixe de locale (toujours présent avec localePrefix: 'always'). */
function stripLocale(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0];
  const isLocale =
    routing.locales.includes(first as "fr" | "en") && parts.length >= 1;
  if (!isLocale) return pathname || "/";
  const rest = parts.slice(1);
  const out = "/" + rest.join("/");
  return out === "//" ? "/" : out.replace(/\/$/, "") || "/";
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const naked = stripLocale(pathname);

  const isLogin = naked === "/login";
  const isPublicAssets =
    naked.startsWith("/api") ||
    naked.startsWith("/trpc") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/trpc") ||
    pathname.includes("/_next") ||
    pathname.includes("/favicon.ico") ||
    /\.[^/]+$/.test(pathname);

  if (
    !isPublicAssets &&
    !isLogin &&
    naked !== "/" &&
    !request.cookies.get(SESSION_COOKIE_NAME)?.value
  ) {
    const localeSegment = pathname.split("/").filter(Boolean)[0];
    const locale = routing.locales.includes(localeSegment as "fr" | "en")
      ? localeSegment
      : routing.defaultLocale;
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
