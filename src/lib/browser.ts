"use client";

import { useSyncExternalStore } from "react";

/**
 * Browser-only facts read through useSyncExternalStore: the server renders the
 * fallback, the client swaps in the real value during hydration without an
 * extra effect-driven render, and changes re-render automatically.
 */

const noop = () => () => {};

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Re-renders when <html data-theme> or the OS colour scheme changes. */
export function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    mq.removeEventListener("change", onChange);
  };
}

let webgl: boolean | undefined;
function detectWebGL(): boolean {
  if (webgl === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}

export function useWebGL(): boolean {
  return useSyncExternalStore(noop, detectWebGL, () => false);
}

/** A value derived from the client clock, refreshed every minute. */
export function useClock<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(
    (onChange) => {
      const id = window.setInterval(onChange, 60_000);
      return () => window.clearInterval(id);
    },
    read,
    () => serverValue,
  );
}
