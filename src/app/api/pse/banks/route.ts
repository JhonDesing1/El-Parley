import { NextResponse } from "next/server";
import { getPSEBanks } from "@/lib/pse/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/pse/banks
 *
 * Devuelve la lista de bancos disponibles para PSE en Colombia.
 * Usado por el formulario de checkout PSE para poblar el selector de banco.
 *
 * La respuesta se puede cachear en el cliente — PayU actualiza la lista rara vez.
 */
export async function GET() {
  try {
    const banks = await getPSEBanks();
    return NextResponse.json({ banks }, { headers: { "Cache-Control": "s-maxage=3600" } });
  } catch (err) {
    console.error("[pse/banks] Error obteniendo bancos PSE:", err);
    return NextResponse.json(
      { error: "No se pudo obtener la lista de bancos. Inténtalo de nuevo." },
      { status: 502 },
    );
  }
}
