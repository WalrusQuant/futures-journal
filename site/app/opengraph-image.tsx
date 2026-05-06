import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "Futures Journal — the opinionated journal for prop-firm futures traders";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#0a0e13",
          backgroundImage:
            "linear-gradient(rgba(94,224,229,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(94,224,229,0.08) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
          color: "#e6edf3",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#5ee0e5",
          }}
        >
          Futures Journal
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 1000,
            }}
          >
            The futures journal I built because none of the others fit how I trade.
          </div>
          <div
            style={{
              marginTop: 32,
              fontSize: 28,
              color: "#8b95a5",
              maxWidth: 900,
            }}
          >
            Opinionated · Local-first · For prop-firm traders
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#8b95a5",
          }}
        >
          <div style={{ display: "flex" }}>walrusquant.github.io/futures-journal</div>
          <div style={{ display: "flex", color: "#5ee0e5" }}>
            Free · Open source
          </div>
        </div>
      </div>
    ),
    size,
  );
}
