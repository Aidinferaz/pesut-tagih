import { ImageResponse } from "next/og";
import { COLORS } from "@/components/pesut/model";

/**
 * App icons drawn from the same pixel Pesut as the fallback sprite, on the
 * river-teal shell with the hull's yellow band and red waterline.
 * /icons/192.png, /icons/512.png and /icons/maskable-512.png.
 */
const ROWS = [
  "............##......",
  "......cc...####.....",
  "....cccc.#########..",
  "...ccy.############.",
  "#...r.#########e####",
  "##...##############w",
  ".#####wwwwwwwwwwwww.",
  "##.....wwwwwwwwww...",
  "#...................",
];
const FILL: Record<string, string> = {
  "#": COLORS.back,
  w: COLORS.belly,
  e: COLORS.eye,
  c: COLORS.cape,
  y: COLORS.hemBand,
  r: COLORS.hemLine,
};

const SIZES: Record<string, { size: number; padding: number }> = {
  "192.png": { size: 192, padding: 0.12 },
  "512.png": { size: 512, padding: 0.12 },
  // Maskable icons get cropped to a circle: keep Pesut inside the safe zone.
  "maskable-512.png": { size: 512, padding: 0.22 },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[file]">) {
  const { file } = await params;
  const spec = SIZES[file];
  if (!spec) return new Response("Not found", { status: 404 });
  const { size, padding } = spec;
  const cell = Math.floor((size * (1 - 2 * padding)) / ROWS[0].length);
  const width = cell * ROWS[0].length;
  const height = cell * ROWS.length;

  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        background: "#0b5d5e",
        display: "flex",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: size * 0.2,
          height: size * 0.05,
          background: "#f4c21b",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: size * 0.13,
          height: size * 0.035,
          background: "#d2382b",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: (size - width) / 2,
          top: (size - height) / 2 - size * 0.06,
          width,
          height,
          display: "flex",
        }}
      >
        {ROWS.flatMap((row, y) =>
          [...row].map((ch, x) =>
            ch === "." ? null : (
              <div
                key={`${x}-${y}`}
                style={{
                  position: "absolute",
                  left: x * cell,
                  top: y * cell,
                  width: cell,
                  height: cell,
                  background: FILL[ch],
                }}
              />
            ),
          ),
        )}
      </div>
    </div>,
    { width: size, height: size },
  );
}
