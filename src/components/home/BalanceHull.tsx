import type { CSSProperties } from "react";
import { wavePath } from "@/components/waterline/wave";

const W = 640;
const H = 176;
const WATER_Y = 118;
/** How far, in viewBox units, a hull may sink or rise at the extremes. */
const TRAVEL = 30;

/**
 * The signature move: your balance as a Mahakam river taxi at its waterline.
 * In debt it sits low with the red waterline under water; owed money lifts it;
 * square at zero it floats level with the stripe right on the surface.
 */
export function BalanceHull({
  balance,
  scale,
  label,
}: {
  balance: number;
  scale: number;
  label: string;
}) {
  const ratio = scale === 0 ? 0 : Math.max(-1, Math.min(1, balance / scale));
  const sink = -ratio * TRAVEL;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={label}>
      <rect width={W} height={H} rx="6" fill="var(--surface-sunk)" />
      {/* Level mark: where the waterline stripe sits when you owe nothing. */}
      <line
        x1="0"
        x2={W}
        y1={WATER_Y}
        y2={WATER_Y}
        stroke="var(--debt)"
        strokeWidth="2"
        strokeDasharray="6 6"
        opacity="0.55"
      />
      <g className="hull-settle" style={{ "--sink": `${sink}px` } as CSSProperties}>
        <g className="hull-bob">
          <Hull />
        </g>
      </g>
      <path
        d={wavePath({ width: W, height: H, y: WATER_Y + 2, amplitude: 4, period: 64 })}
        fill="var(--water)"
        opacity="0.92"
      />
    </svg>
  );
}

/** Drawn so that its red waterline stripe lands exactly on WATER_Y when level. */
function Hull() {
  const top = WATER_Y - 30;
  return (
    <g transform={`translate(96 ${top})`} stroke="#082f33" strokeWidth="3" strokeLinejoin="round">
      {/* Roof and cabin of a river taxi. The boat keeps its own paint in both themes. */}
      <rect x="92" y="-50" width="250" height="10" fill="#0b5d5e" />
      <rect x="108" y="-40" width="218" height="40" fill="#f3f5f0" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={124 + i * 40}
          y="-30"
          width="24"
          height="18"
          fill="#0b5d5e"
          strokeWidth="2"
        />
      ))}
      <clipPath id="hull-shape">
        <path d="M0 0 H412 L448 -18 L406 64 H30 L0 30 Z" />
      </clipPath>
      <path d="M0 0 H412 L448 -18 L406 64 H30 L0 30 Z" fill="#f3f5f0" />
      <g clipPath="url(#hull-shape)" stroke="none">
        <rect x="-10" y="14" width="470" height="10" fill="var(--band)" />
        <rect x="-10" y="28" width="470" height="6" fill="var(--debt)" />
        <rect x="-10" y="34" width="470" height="40" fill="#0b5d5e" />
      </g>
      <path d="M0 0 H412 L448 -18 L406 64 H30 L0 30 Z" fill="none" />
    </g>
  );
}
