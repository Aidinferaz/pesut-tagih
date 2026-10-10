import type { ComponentPropsWithoutRef } from "react";

/** The painted board every section sits on: flat surface, 2px outline. */
export function Panel({ className = "", ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={`border-line-strong bg-surface rounded-[10px] border-2 p-5 sm:p-6 ${className}`}
      {...props}
    />
  );
}

export function PanelTitle({ className = "", ...props }: ComponentPropsWithoutRef<"h2">) {
  return <h2 className={`display text-[1.375rem] uppercase ${className}`} {...props} />;
}
