import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/api-football-status?secret=CRON_SECRET
 * Consulta el endpoint /status de API-Football para verificar la suscripción activa,
 * plan, requests usados y requests restantes del día.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    return NextResponse.json({ error: "API_FOOTBALL_KEY no configurada" }, { status: 500 });
  }

  const host = process.env.API_FOOTBALL_HOST ?? "v3.football.api-sports.io";

  try {
    const res = await fetch(`https://${host}/status`, {
      headers: {
        "x-apisports-key": key,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `API-Football respondió ${res.status} ${res.statusText}` },
        { status: 502 },
      );
    }

    const json = await res.json();

    if (json.errors && Object.keys(json.errors).length > 0) {
      return NextResponse.json({ error: "API error", details: json.errors }, { status: 502 });
    }

    const data = json.response;
    return NextResponse.json({
      account: data?.account,
      subscription: data?.subscription,
      requests: data?.requests,
      raw: data,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error conectando con API-Football", message: String(err) },
      { status: 502 },
    );
  }
}
