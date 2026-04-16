import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 7,
        }}
      >
        {/* Lightning bolt — matches brand icon */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#D97706"
          strokeWidth="3"
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
