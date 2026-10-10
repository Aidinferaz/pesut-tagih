"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { subscribeTheme, useMediaQuery, useWebGL } from "@/lib/browser";
import { usePesut } from "./mood";
import { PesutSprite } from "./PesutSprite";

const PesutScene = dynamic(() => import("./PesutScene"), { ssr: false });

const FALLBACK = { water: "#0b5d5e", foam: "#d9e7e3" };

/** Resolves the river tokens to rgb() by letting the browser compute them. */
let probe: HTMLSpanElement | null = null;
function readPalette(): string {
  if (!probe) {
    probe = document.createElement("span");
    probe.hidden = true;
    document.body.append(probe);
  }
  const resolve = (token: string) => {
    probe!.style.color = `var(${token})`;
    return getComputedStyle(probe!).color;
  };
  return `${resolve("--water")}|${resolve("--water-foam")}`;
}

export type PesutStageProps = {
  /** Accessible name of the poke button, describing Pesut. */
  label: string;
  onPoke?: () => void;
  /** Must position the stage (relative or absolute); defaults to relative. */
  className?: string;
  children?: ReactNode;
};

/**
 * Hosts the 3D Pesut: decides between WebGL and the flat sprite, pauses the
 * render loop off-screen and in hidden tabs, honours reduced motion, tracks
 * the pointer across the whole page, and turns the stage into one big poke
 * button so mouse, touch and keyboard all reach it.
 */
export function PesutStage({ label, onPoke, className, children }: PesutStageProps) {
  const host = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const webgl = useWebGL();
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const palette = useSyncExternalStore(subscribeTheme, readPalette, () => "");
  const [water, foam] = palette ? palette.split("|") : [FALLBACK.water, FALLBACK.foam];
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = host.current;
    let onScreen = true;
    const sync = () => setVisible(onScreen && document.visibilityState === "visible");
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    if (el) io.observe(el);
    document.addEventListener("visibilitychange", sync);

    const onMove = (event: PointerEvent) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      pointer.current = {
        x: clamp((event.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)),
        y: clamp(-(event.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)),
      };
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const poke = () => {
    usePesut.getState().act("poke");
    onPoke?.();
  };

  return (
    <div ref={host} className={className ?? "relative"}>
      {webgl ? (
        <PesutScene
          water={water}
          foam={foam}
          active={visible && !still}
          still={still}
          pointer={pointer}
        />
      ) : (
        <div className="flex h-full items-end justify-center pb-6">
          <PesutSprite className="w-2/5 max-w-56" />
        </div>
      )}
      <button
        type="button"
        onClick={poke}
        aria-label={label}
        className="absolute inset-0 cursor-pointer rounded-[inherit] focus-visible:outline-offset-[-4px]"
      />
      {children}
    </div>
  );
}
