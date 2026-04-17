import { NextResponse } from "next/server";

/**
 * Stripe checkout deshabilitado — El Parley usa PayU y MercadoPago.
 * Este endpoint redirige al flujo de pago por defecto.
 */
export async function GET() {
  return NextResponse.redirect(
    new URL("/premium", process.env.NEXT_PUBLIC_SITE_URL ?? "https://elparley.com"),
    303,
  );
}
