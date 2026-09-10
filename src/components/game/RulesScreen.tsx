import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FarmScene } from "@/components/game/FarmScene";
import { HOW_TO_STEPS, RULE_BLURBS, RULE_LABELS } from "@/game/names";
import type { RuleSet } from "@/game/types";

export function RulesScreen({ onBack }: { onBack: () => void }) {
  return (
    <FarmScene>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <Button variant="secondary" className="mb-4 w-fit" onClick={onBack}>
          <ArrowLeft />
          Back
        </Button>
        <div className="farm-card rounded-2xl px-4 py-5 sm:px-5">
          <h1 className="font-display text-3xl">How to play</h1>
          <ol className="mt-4 space-y-3">
            {HOW_TO_STEPS.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-fg">
                <span className="font-display text-lg text-primary tabular-nums">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <h2 className="mt-8 font-display text-xl">Three ways to empty the yards</h2>
          <div className="mt-3 space-y-3">
            {(Object.keys(RULE_LABELS) as RuleSet[]).map((key) => (
              <article key={key} className="farm-panel rounded-xl p-4">
                <h3 className="font-display text-lg">{RULE_LABELS[key]}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{RULE_BLURBS[key]}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </FarmScene>
  );
}
