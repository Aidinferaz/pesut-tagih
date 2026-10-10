import type { Hull } from "@/server/db/groups";

const HULL: Record<Hull, string> = {
  band: "bg-band",
  action: "bg-action",
  surface: "bg-rail-ink border border-line-strong",
  debt: "bg-debt",
};

/** A group's colour, painted as a little hull with a raised bow. */
export function HullSwatch({ hull, className = "h-4 w-8" }: { hull: Hull; className?: string }) {
  return (
    <i
      aria-hidden
      className={`block shrink-0 ${HULL[hull]} ${className}`}
      style={{ clipPath: "polygon(0 0, 100% 0, 82% 100%, 0 100%)" }}
    />
  );
}
