/**
 * Pesut, built voxel by voxel from code.
 *
 * An Irrawaddy dolphin (pesut Mahakam): slate grey-blue back, pale belly, a
 * round melon of a head with no beak, and a cape
 * in the brand's life-ring orange with the hull's yellow-and-red hem.
 *
 * Units are voxels. The body runs along x (tail at -x, head at +x), y is up and
 * z is across. Each animated part is its own list with its own pivot so the rig
 * can rotate it without touching the rest.
 */

export type Voxel = { x: number; y: number; z: number; color: string };

export const COLORS = {
  back: "#7e95a4",
  backAlt: "#8aa0ae",
  belly: "#cbd7dd",
  bellyAlt: "#d6e0e5",
  mouth: "#4f6573",
  eye: "#10242a",
  eyeShine: "#ffffff",
  cape: "#f2781e",
  capeShade: "#d9661a",
  hemBand: "#f4c21b",
  hemLine: "#d2382b",
  clasp: "#f4c21b",
} as const;

const HEAD_LENGTH = 9.6;
const TAIL_LENGTH = 10;
const MAX_RADIUS = 5.2;
const WIDTH_RATIO = 0.82;

/** Body half-height at position x: a rounded head in front, a tapering stock behind. */
export function bodyRadius(x: number): number {
  if (x >= 0) return MAX_RADIUS * Math.sqrt(Math.max(0, 1 - (x / HEAD_LENGTH) ** 2));
  return Math.max(0.9, MAX_RADIUS * (1 - (Math.abs(x) / (TAIL_LENGTH + 2)) ** 1.6));
}

/** Height of the back's surface above the centreline at (x, z). */
export function backHeight(x: number, z: number): number {
  const ry = bodyRadius(x);
  const rz = ry * WIDTH_RATIO;
  return Math.abs(z) >= rz ? 0 : ry * Math.sqrt(1 - (z / rz) ** 2);
}

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
/** Cheap deterministic hash so neighbouring voxels alternate shade like painted wood. */
const speckle = (x: number, y: number, z: number) => ((x * 7 + y * 13 + z * 5) & 3) === 0;

function insideBody(x: number, y: number, z: number): boolean {
  if (x < -TAIL_LENGTH || x > HEAD_LENGTH) return false;
  const ry = bodyRadius(x);
  const rz = ry * WIDTH_RATIO;
  return (y / ry) ** 2 + (z / rz) ** 2 <= 1;
}

/** The hull of the body only: interior voxels are culled because nobody sees them. */
export function buildBody(): Voxel[] {
  const out: Voxel[] = [];
  const r = Math.ceil(MAX_RADIUS);
  for (let x = -TAIL_LENGTH; x <= Math.floor(HEAD_LENGTH); x += 1) {
    for (let y = -r; y <= r; y += 1) {
      for (let z = -r; z <= r; z += 1) {
        if (!insideBody(x, y, z)) continue;
        const hidden =
          insideBody(x + 1, y, z) &&
          insideBody(x - 1, y, z) &&
          insideBody(x, y + 1, z) &&
          insideBody(x, y - 1, z) &&
          insideBody(x, y, z + 1) &&
          insideBody(x, y, z - 1);
        if (hidden) continue;

        const ry = bodyRadius(x);
        const isBelly = y < -0.3 * ry;
        // The smile: a darker seam low on the front of the head.
        const isMouth = x >= 5 && x <= 8 && y === Math.round(-0.3 * ry);
        const color = isMouth
          ? COLORS.mouth
          : isBelly
            ? speckle(x, y, z)
              ? COLORS.bellyAlt
              : COLORS.belly
            : speckle(x, y, z)
              ? COLORS.backAlt
              : COLORS.back;
        out.push({ x, y, z, color });
      }
    }
  }

  return dedupe(out);
}

/** Two eyes, two voxels tall, as their own part so the rig can blink them. The last two are highlights. */
export function buildEyes(): Voxel[] {
  const x = 6;
  const y = 1;
  const rz = bodyRadius(x) * WIDTH_RATIO * Math.sqrt(1 - (y / bodyRadius(x)) ** 2);
  const z = Math.round(rz);
  return [
    { x, y, z, color: COLORS.eye },
    { x, y: y + 1, z, color: COLORS.eye },
    { x, y, z: -z, color: COLORS.eye },
    { x, y: y + 1, z: -z, color: COLORS.eye },
    { x: x + 0.35, y: y + 1.3, z: z + 0.2, color: COLORS.eyeShine },
    { x: x + 0.35, y: y + 1.3, z: -z - 0.2, color: COLORS.eyeShine },
  ];
}

/** One pectoral fin, local to its pivot at the body's side. `side` is 1 (left) or -1 (right). */
export function buildFin(side: 1 | -1): Voxel[] {
  const cells: [number, number][] = [
    [0, 1],
    [-1, 1],
    [0, 2],
    [-1, 2],
    [-2, 2],
    [-1, 3],
    [-2, 3],
  ];
  return cells.map(([x, dz]) => ({ x, y: 0, z: side * dz, color: COLORS.back }));
}

export const FIN_PIVOT = { x: 3, y: -2 };
export function finPivotZ(): number {
  return Math.round(bodyRadius(FIN_PIVOT.x) * WIDTH_RATIO * 0.8);
}

/** Tail stock and crescent fluke, local to a pivot just behind the body. */
export const FLUKE_PIVOT_X = -TAIL_LENGTH;
export function buildFluke(): Voxel[] {
  const rows: [number, (z: number) => boolean][] = [
    [-1, (z) => z === 0],
    [-2, (z) => Math.abs(z) <= 1],
    [-3, (z) => Math.abs(z) <= 3],
    [-4, (z) => Math.abs(z) >= 1 && Math.abs(z) <= 4],
    [-5, (z) => Math.abs(z) >= 3 && Math.abs(z) <= 4],
  ];
  const out: Voxel[] = [];
  for (const [x, keep] of rows) {
    for (let z = -4; z <= 4; z += 1) {
      if (keep(z)) out.push({ x, y: 0, z, color: speckle(x, 0, z) ? COLORS.backAlt : COLORS.back });
    }
  }
  return out;
}

/**
 * The cape as a grid draped over the back. `u` runs from the neck (0) to the
 * hem, `v` across. The rig ripples each voxel by its `u`, so the grid order is
 * kept alongside the voxel.
 */
export type CapeCell = Voxel & { u: number; v: number };
export const CAPE_LENGTH = 12;

export function buildCape(): CapeCell[] {
  const out: CapeCell[] = [];
  const neck = 0;
  // A one-voxel sheet tied behind the head, lying on the back and trailing
  // past the tail like a cape in the current. It never rises above the back,
  // so it reads as a cape, not a hat.
  for (let u = 0; u < CAPE_LENGTH; u += 1) {
    const x = neck - u;
    const half = Math.min(3 + Math.floor(u / 3), 5);
    const rz = bodyRadius(x) * WIDTH_RATIO;
    for (let v = -half; v <= half; v += 1) {
      const onBack = Math.abs(v) < rz - 0.5;
      // Over the body it follows the round of the back; past the edge it hangs down the flank.
      const y = onBack
        ? Math.round(backHeight(x, v)) + 1
        : Math.max(0, Math.round(bodyRadius(x) * 0.15)) - (Math.abs(v) - Math.ceil(rz)) + 1;
      const color =
        u === CAPE_LENGTH - 1
          ? COLORS.hemLine
          : u === CAPE_LENGTH - 2
            ? COLORS.hemBand
            : Math.abs(v) === half
              ? COLORS.capeShade
              : COLORS.cape;
      out.push({ x, y, z: v, color, u, v });
    }
  }
  // Clasp at the throat, both sides.
  const clasp = Math.round(bodyRadius(neck + 1) * WIDTH_RATIO);
  out.push({ x: neck + 1, y: 1, z: clasp, color: COLORS.clasp, u: 0, v: clasp });
  out.push({ x: neck + 1, y: 1, z: -clasp, color: COLORS.clasp, u: 0, v: -clasp });
  return out;
}

function dedupe(voxels: Voxel[]): Voxel[] {
  const seen = new Set<string>();
  return voxels.filter((v) => {
    const k = key(v.x, v.y, v.z);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
