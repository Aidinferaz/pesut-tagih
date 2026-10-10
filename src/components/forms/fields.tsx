import type { ComponentPropsWithoutRef, ReactNode } from "react";

export const inputClass =
  "min-h-11 w-full rounded-md border-2 border-line-strong bg-surface px-3 text-[0.9375rem] placeholder:text-muted aria-[invalid=true]:border-debt";

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-debt text-sm font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: ComponentPropsWithoutRef<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function FormMessage({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`text-sm font-semibold ${tone === "ok" ? "text-credit" : "text-debt"}`}
    >
      {children}
    </p>
  );
}
