import { NextResponse } from "next/server";

/** PayU webhook deshabilitado temporalmente. */
export async function POST() {
  return NextResponse.json({ disabled: true }, { status: 404 });
}
