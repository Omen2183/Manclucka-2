import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RULE_BLURBS, RULE_LABELS } from "@/game/names";
import type { RuleSet } from "@/game/types";

const STEPS = [
  "Each player has six fenced yards and a chicken coop. Every yard starts with four Orpingtons.",
  "On your turn pick one of your yards. Sow those hens one by one counterclockwise, skipping the other coop.",
  "If the last hen lands in your coop, take another turn.",
  "If she lands in an empty yard on your side, she calls the opposite flock home — that's a capture.",
];

export function RulesScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-10 pt-4">
      <Button variant="ghost" className="mb-4 w-fit" onClick={onBack}>
        <ArrowLeft />
        Back
      </Button>
      <h1 className="font-display text-3xl">How to play</h1>
      <ol className="mt-4 space-y-3">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm leading-relaxed text-fg">
            <span className="font-display text-lg text-primary tabular-nums">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <h2 className="mt-8 font-display text-xl">Three flocks, three rules</h2>
      <div className="mt-3 space-y-3">
        {(Object.keys(RULE_LABELS) as RuleSet[]).map((key) => (
          <article key={key} className="rounded-xl border border-border bg-surface p-4">
            <h3 className="font-display text-lg">{RULE_LABELS[key]}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{RULE_BLURBS[key]}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
