import { NextResponse } from "next/server";

/** PayU response deshabilitado temporalmente. */
export async function GET() {
  return NextResponse.redirect(
    new URL("/premium", process.env.NEXT_PUBLIC_SITE_URL ?? "https://elparley.com"),
    303,
  );
}

export async function POST() {
  return NextResponse.redirect(
    new URL("/premium", process.env.NEXT_PUBLIC_SITE_URL ?? "https://elparley.com"),
    303,
  );
}
