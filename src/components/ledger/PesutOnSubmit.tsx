"use client";

import type { ReactNode } from "react";
import { usePesut, type PesutAction } from "@/components/pesut/mood";

/** A submit button that also makes Pesut react, for forms that stay server-rendered. */
export function PesutOnSubmit({
  action,
  line,
  className,
  children,
}: {
  action: PesutAction;
  line: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={() => {
        usePesut.getState().act(action);
        usePesut.getState().say(line);
      }}
    >
      {children}
    </button>
  );
}
