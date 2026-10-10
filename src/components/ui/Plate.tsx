/** A registration plate as painted on a boat's bow: teal block, yellow numerals. */
export function Plate({ children, size = "md" }: { children: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`figure bg-plate text-plate-ink inline-flex items-center justify-center rounded-[4px] leading-none whitespace-nowrap ${
        size === "sm" ? "px-1.5 py-0.5 text-[0.9375rem]" : "px-2 py-1 text-[1.0625rem]"
      }`}
    >
      {children}
    </span>
  );
}
