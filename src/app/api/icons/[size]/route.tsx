import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ size: string }> },
) {
  await params; // size unused — we serve the same PNG for all sizes
  const filePath = path.join(process.cwd(), "public", "favicon.png");
  const buffer = await readFile(filePath);
  return new NextResponse(buffer, {
    headers: { "Content-Type": "image/png" },
  });
}
