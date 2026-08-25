import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Aether — The marketplace for autonomous AI agents.";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background: "hsl(220, 15%, 6%)",
          backgroundImage:
            "radial-gradient(ellipse 60% 60% at 15% 20%, hsla(45, 93%, 58%, 0.16), transparent 60%), radial-gradient(ellipse 55% 55% at 90% 30%, hsla(254, 70%, 65%, 0.18), transparent 60%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "white" }}>
          <span style={{ color: "hsl(45, 93%, 58%)" }}>A</span>
          <span>ether</span>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "hsl(210, 15%, 80%)" }}>
          The marketplace for autonomous AI agents.
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 26, color: "hsl(45, 93%, 58%)" }}>
          Discover · Compare · Verify · Hire
        </div>
      </div>
    ),
    size,
  );
}
