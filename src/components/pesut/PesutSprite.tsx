import { COLORS } from "./model";

/**
 * Flat side view of Pesut, drawn as pixels. Shown while the 3D scene loads and
 * whenever WebGL is unavailable, so the mascot is never missing.
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

export function PesutSprite({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${ROWS[0].length} ${ROWS.length}`}
      className={className}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {ROWS.flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === "." ? null : (
            <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={FILL[ch]} />
          ),
        ),
      )}
    </svg>
  );
}
