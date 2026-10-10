import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type Variant = "primary" | "outline" | "ghost";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 px-4 text-[0.9375rem] font-bold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ease-out-quint active:translate-y-px disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-sunk disabled:text-muted disabled:active:translate-y-0";

const variants: Record<Variant, string> = {
  primary: "border-action bg-action text-action-ink enabled:hover:brightness-105",
  outline: "border-line-strong bg-transparent text-ink hover:bg-surface-sunk",
  ghost: "border-transparent bg-transparent text-ink hover:bg-surface-sunk",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
