import { create } from "zustand";

/**
 * What Pesut feels (a lasting mood driven by app state) and what Pesut does
 * (a one-off action fired by an event). Anything in the app can call `act`,
 * for example after a payment is confirmed, and the rig plays it once.
 */
export type PesutMood = "idle" | "worried" | "happy" | "thinking";
export type PesutAction = "poke" | "jump" | "squirt" | "celebrate";

type PesutState = {
  mood: PesutMood;
  action: { kind: PesutAction; at: number } | null;
  /** What Pesut is saying in the speech bubble right now, if anything new. */
  line: string | null;
  setMood: (mood: PesutMood) => void;
  act: (kind: PesutAction) => void;
  say: (line: string | null) => void;
};

export const usePesut = create<PesutState>((set) => ({
  mood: "idle",
  action: null,
  line: null,
  setMood: (mood) => set({ mood }),
  act: (kind) => set({ action: { kind, at: performance.now() } }),
  say: (line) => set({ line }),
}));

/** How long each action takes, in seconds. The rig and the UI both read this. */
export const ACTION_DURATION: Record<PesutAction, number> = {
  poke: 0.9,
  jump: 1.4,
  squirt: 1.6,
  celebrate: 2.2,
};
