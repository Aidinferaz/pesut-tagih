"use client";

import { PesutStage } from "@/components/pesut/PesutStage";
import { usePesut } from "@/components/pesut/mood";
import { useI18n } from "@/i18n/provider";

/** The landing page's Pesut: a big river stage with a greeting that changes when poked. */
export function LandingPesut() {
  const { t } = useI18n();
  const line = usePesut((s) => s.line) ?? t.landing.bubble;
  return (
    <div className="border-line-strong bg-surface relative isolate min-h-[22rem] overflow-hidden rounded-[10px] border-2 lg:min-h-[34rem]">
      <p
        aria-live="polite"
        className="border-line-strong bg-surface relative z-10 m-4 max-w-[20rem] rounded-[10px] border-2 px-4 py-3 font-semibold"
      >
        {line}
      </p>
      <PesutStage
        label={t.pesut.sceneLabel}
        className="absolute inset-0"
        onPoke={() => {
          const pokes = t.pesut.poke;
          usePesut.getState().say(pokes[Math.floor(Math.random() * pokes.length)]);
        }}
      />
    </div>
  );
}
