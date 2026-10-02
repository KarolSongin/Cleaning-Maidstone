import { ImageResponse } from "next/og";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#eef5fa",
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 80,
        flexDirection: "column",
        justifyContent: "center",
        color: "#183650",
      }}
    >
      <span style={{ fontSize: 28, letterSpacing: 5 }}>CLEANING MAIDSTONE</span>
      <span style={{ fontSize: 86, marginTop: 38, lineHeight: 1.1 }}>
        Domestic cleaning.
      </span>
      <span style={{ fontSize: 86, color: "#2673ab" }}>
        More time for life.
      </span>
      <span style={{ fontSize: 26, marginTop: 40 }}>
        Weekly & fortnightly · Maidstone · From £18/hour
      </span>
    </div>,
    size,
  );
}
