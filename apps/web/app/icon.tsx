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
          background: "hsl(220, 15%, 6%)",
          borderRadius: 6,
          fontFamily: "sans-serif",
        }}
      >
        <span style={{ color: "hsl(45, 93%, 58%)", fontSize: 20, fontWeight: 700 }}>A</span>
      </div>
    ),
    size,
  );
}
