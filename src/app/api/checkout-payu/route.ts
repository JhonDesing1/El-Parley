import { NextResponse } from "next/server";

/** PayU deshabilitado temporalmente — se usa MercadoPago. */
export async function GET() {
  return NextResponse.redirect(
    new URL("/premium", process.env.NEXT_PUBLIC_SITE_URL ?? "https://elparley.com"),
    303,
  );
}
