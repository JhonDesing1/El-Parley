import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0b10",
          borderRadius: 36,
        }}
      >
        <svg
          width="110"
          height="110"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#D97706"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2L4.09 12.96a.5.5 0 0 0 .4.8H11l-1 8.24 8.91-10.96a.5.5 0 0 0-.4-.8H13l1-8.24z" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
