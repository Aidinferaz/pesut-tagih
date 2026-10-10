"use client";

import { useEffect, useRef } from "react";
import { usePesut, type PesutMood } from "@/components/pesut/mood";
import { PesutStage } from "@/components/pesut/PesutStage";
import { useI18n } from "@/i18n/provider";

/**
 * Pesut's corner of the river. The speech bubble is a live region so whatever
 * Pesut says is announced.
 */
export function PesutRiver({ mood, opening }: { mood: PesutMood; opening: string }) {
  const { t } = useI18n();
  const text = usePesut((s) => s.line) ?? opening;
  const pokes = useRef(0);

  // Pesut's mood follows this page's data; whatever was said here is
  // forgotten on the way out so the next page starts with its own line.
  useEffect(() => {
    const pesut = usePesut.getState();
    pesut.setMood(mood);
    return () => pesut.say(null);
  }, [mood]);

  const onPoke = () => {
    usePesut.getState().say(t.pesut.poke[pokes.current % t.pesut.poke.length]);
    pokes.current += 1;
  };

  const chaseAll = () => {
    usePesut.getState().act("squirt");
    usePesut.getState().say(t.pesut.chaseAllLine);
  };

  return (
    <section className="border-line-strong bg-surface relative isolate flex min-h-[20rem] flex-col overflow-hidden rounded-[10px] border-2 lg:min-h-[23rem]">
      <p
        aria-live="polite"
        className="border-line-strong bg-surface relative z-10 m-4 max-w-[19rem] self-start rounded-[10px] border-2 px-4 py-3 text-[0.9375rem] font-semibold"
      >
        {text}
      </p>
      <PesutStage
        label={t.pesut.sceneLabel}
        onPoke={onPoke}
        className="absolute inset-0 rounded-[8px]"
      />
      <div className="pointer-events-none relative z-10 mt-auto flex justify-end p-4">
        <button
          type="button"
          onClick={chaseAll}
          className="border-line-strong bg-band pointer-events-auto min-h-11 rounded-md border-2 px-4 text-[0.9375rem] font-bold text-[#082f33]"
        >
          {t.pesut.chaseAll}
        </button>
      </div>
    </section>
  );
}
