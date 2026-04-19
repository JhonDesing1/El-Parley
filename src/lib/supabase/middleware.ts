import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rutas protegidas — todas las páginas bajo el route group (app).
  // Actualizar esta lista cuando se agregue una nueva página en src/app/(app)/.
  // Rutas que requieren sesión activa.
  // /partido, /premium, /value-bets y /parlays son públicas (tienen tiering propio).
  const protectedPaths = [
    "/dashboard",
    "/mis-picks",
    "/api-key",
    "/webhooks",
    "/bankroll",
    "/backtesting",
    "/telegram",
  ];
  const isProtected = protectedPaths.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const fullPath = request.nextUrl.pathname + request.nextUrl.search;
    url.searchParams.set("next", fullPath);
    return NextResponse.redirect(url);
  }

  return response;
}
