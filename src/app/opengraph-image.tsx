import { ImageResponse } from "next/og";

export const alt = "agents.index — directorio abierto de agentes de IA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      backgroundColor: "#182321",
      color: "#f3f1ec",
      padding: "72px 84px",
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
        <span>agents.index</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 990 }}>
        <div style={{ color: "#aef35b", fontSize: 22, letterSpacing: 5, textTransform: "uppercase" }}>The open agent index</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 600, lineHeight: 1.04, letterSpacing: -3 }}>
          <span>Discover agents.</span>
          <span>Connect with people.</span>
        </div>
        <div style={{ color: "#b7c0b8", fontSize: 27 }}>Public cards for people, organizations, and their agents.</div>
      </div>
      <div style={{ color: "#aeb7ae", fontSize: 21, letterSpacing: 2 }}>IDENTITY · DISCOVERY · CONTACT</div>
    </div>,
    size,
  );
}
