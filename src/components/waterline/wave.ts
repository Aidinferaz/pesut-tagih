/**
 * The one geometry behind the waterline: the same painted wave edges the
 * balance hull's river and the top of Pesut's river panel.
 * Returns an SVG path that fills everything below a wavy line at `y`.
 */
export function wavePath({
  width,
  height,
  y,
  amplitude = 5,
  period = 80,
}: {
  width: number;
  height: number;
  y: number;
  amplitude?: number;
  period?: number;
}): string {
  const half = period / 2;
  let d = `M0 ${y}`;
  for (let x = 0, up = true; x < width; x += half, up = !up) {
    d += ` Q${x + half / 2} ${y + (up ? -amplitude : amplitude)} ${x + half} ${y}`;
  }
  return `${d} L${width} ${height} L0 ${height} Z`;
}
