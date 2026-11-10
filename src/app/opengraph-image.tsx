import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants/site";

/**
- The share card for links to the site (Open Graph and Twitter). Next.js
- renders this component to a PNG at build time and wires up the <meta> tags.
 */
export const alt = `${SITE.name}: mock interviews with honest feedback`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0a1d21",
          color: "#f3ead6",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#143339",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: 12,
            }}
          >
            <div style={{ width: 34, height: 13, borderRadius: 3, background: "#f4d03f" }} />
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>Candor</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2, maxWidth: 980 }}>
            Find the exact sentence that sank your answer.
          </div>
          <div style={{ width: 360, height: 14, borderRadius: 4, background: "#f4d03f", opacity: 0.85 }} />
        </div>

        <div style={{ display: "flex", fontSize: 28, color: "#9bb2ae" }}>
          Mock interviews with highlighted feedback · {SITE.course}
        </div>
      </div>
    ),
    { ...size },
  );
}