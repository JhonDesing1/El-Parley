import { NextResponse } from "next/server";

/**
 * Stripe webhook deshabilitado — El Parley usa PayU y MercadoPago.
 */
export async function POST() {
  return NextResponse.json({ disabled: true }, { status: 404 });
}
