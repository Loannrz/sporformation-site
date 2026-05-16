import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "./i18n/routing";
import { copySupabaseSessionToResponse } from "@/lib/supabase/refresh-session";
import { getSupabaseConnectionConfig } from "@/lib/supabase/env";
import { teacherDocumentsGateBypassPath } from "@/lib/teacher-documents-gate";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  let response = intlMiddleware(request);
  response = await copySupabaseSessionToResponse(request, response);

  const { url: supabaseUrl, anonKey } = getSupabaseConnectionConfig();
  if (!supabaseUrl || !anonKey) return response;

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return response;

  const { data: needsGate, error: gateRpcErr } = await supabase.rpc(
    "profile_needs_teacher_documents_gate",
    { p_user_id: user.id },
  );
  // Migration non appliquée ou erreur réseau : ne pas bloquer l’app.
  if (gateRpcErr || needsGate !== true) return response;

  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/(fr|en)(\/|$)/);
  const locale = localeMatch?.[1] ?? routing.defaultLocale;
  let pathWithoutLocale =
    localeMatch?.index !== undefined
      ? pathname.slice(localeMatch.index + locale.length + 1) || "/"
      : pathname;
  if (!pathWithoutLocale.startsWith("/")) {
    pathWithoutLocale = `/${pathWithoutLocale}`;
  }

  if (teacherDocumentsGateBypassPath(pathWithoutLocale)) return response;

  const redirectUrl = new URL(
    `/${locale}/documents-a-fournir`,
    request.url,
  );
  const redirectResponse = NextResponse.redirect(redirectUrl);
  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length) {
    for (const c of setCookies) {
      redirectResponse.headers.append("Set-Cookie", c);
    }
  } else {
    for (const c of response.cookies.getAll()) {
      redirectResponse.cookies.set(c.name, c.value);
    }
  }
  return redirectResponse;
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
