/** A registration plate as painted on a boat's bow: teal block, yellow numerals. */
export function Plate({ children }: { children: string }) {
  return (
    <span className="figure bg-plate text-plate-ink inline-flex min-w-[5.25rem] items-center justify-center rounded-[4px] px-2 py-1 text-[1.0625rem] leading-none">
      {children}
    </span>
  );
}
