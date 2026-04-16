import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: sizeParam } = await params;
  const dim = sizeParam === "512" ? 512 : 192;
  const radius = Math.round(dim * 0.14);
  const iconSize = Math.round(dim * 0.55);

  return new ImageResponse(
    (
      <div
        style={{
          width: dim,
          height: dim,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0d0e16 0%, #0a0b10 100%)",
          borderRadius: radius,
        }}
      >
        {/* Gold glow */}
        <div
          style={{
            position: "absolute",
            width: dim * 0.6,
            height: dim * 0.6,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(217,119,6,0.25) 0%, transparent 70%)",
          }}
        />
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#D97706"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2L4.09 12.96a.5.5 0 0 0 .4.8H11l-1 8.24 8.91-10.96a.5.5 0 0 0-.4-.8H13l1-8.24z" />
        </svg>
      </div>
    ),
    { width: dim, height: dim },
  );
}
