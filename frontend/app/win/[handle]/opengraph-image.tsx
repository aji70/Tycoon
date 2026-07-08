import { ImageResponse } from "next/og";

export const alt = "Winner on Tycoon";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Decode + sanitize the username from the URL for the card. */
function cleanHandle(raw: string): string {
  let h = "";
  try {
    h = decodeURIComponent(raw);
  } catch {
    h = raw;
  }
  h = h.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (h.length > 22) h = `${h.slice(0, 21)}…`;
  return h || "A Tycoon";
}

export default function OpengraphImage({
  params,
}: {
  params: { handle: string };
}) {
  const handle = cleanHandle(params.handle);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#010F10",
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(34,211,238,0.28), transparent 55%), linear-gradient(135deg, #0b1026 0%, #010F10 60%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 30,
            letterSpacing: 14,
            color: "#67e8f9",
            fontWeight: 800,
            textTransform: "uppercase",
          }}
        >
          Tycoon
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 150,
            height: 150,
            marginTop: 34,
            marginBottom: 34,
            borderRadius: 999,
            border: "4px solid rgba(34,211,238,0.5)",
            backgroundColor: "rgba(8,47,73,0.55)",
            color: "#22d3ee",
            fontSize: 96,
            fontWeight: 900,
          }}
        >
          ★
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 40,
            letterSpacing: 10,
            color: "#e2e8f0",
            fontWeight: 800,
            textTransform: "uppercase",
          }}
        >
          Winner
        </div>

        <div
          style={{
            display: "flex",
            maxWidth: 1000,
            marginTop: 12,
            fontSize: 88,
            fontWeight: 900,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.05,
          }}
        >
          {handle}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 30,
            fontSize: 34,
            color: "#94a3b8",
            fontWeight: 500,
          }}
        >
          ran the table on on-chain Monopoly — can you beat them?
        </div>
      </div>
    ),
    { ...size }
  );
}
