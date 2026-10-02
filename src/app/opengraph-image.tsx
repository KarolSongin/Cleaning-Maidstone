import { ImageResponse } from "next/og";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#f6f3ec",
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 80,
        flexDirection: "column",
        justifyContent: "center",
        color: "#183c50",
      }}
    >
      <span style={{ fontSize: 28, letterSpacing: 5 }}>CLEANING MAIDSTONE</span>
      <span style={{ fontSize: 86, marginTop: 38, lineHeight: 1.1 }}>
        A little more calm.
      </span>
      <span style={{ fontSize: 86, color: "#bb6685" }}>
        A lot less housework.
      </span>
      <span style={{ fontSize: 26, marginTop: 40 }}>
        Weekly & fortnightly domestic cleaning · Maidstone
      </span>
    </div>,
    size,
  );
}
