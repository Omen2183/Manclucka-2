import { BookOpen, Play } from "lucide-react";
import { HenMark } from "@/components/HenMark";
import { Button } from "@/components/ui/button";
import { HERO_SRC } from "@/game/breeds";
import { loadStats } from "@/lib/persist";
import { useMemo } from "react";

export function MenuScreen({
  onPlay,
  onRules,
}: {
  onPlay: () => void;
  onRules: () => void;
}) {
  const stats = useMemo(() => loadStats(), []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <img
          src={HERO_SRC}
          alt="Orpington hens by a backyard coop"
          className="h-44 w-full object-cover sm:h-56"
          crossOrigin="anonymous"
        />
        <div className="px-5 pb-6 pt-5">
          <div className="flex items-center gap-2 text-primary">
            <HenMark className="size-8" />
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">backyard kalah</p>
          </div>
          <h1 className="mt-2 font-display text-4xl tracking-[-0.03em] text-fg sm:text-5xl">Manclucka</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Sow your Orpingtons around the fenced yards. Land in your coop for another turn. A friendly capture
            crows the rooster; when the other side steals your hens, they panic.
          </p>
          {stats.played > 0 && (
            <p className="mt-3 text-sm text-muted">
              {stats.won} series win{stats.won === 1 ? "" : "s"} · {stats.played} series played
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <Button size="lg" onClick={onPlay}>
              <Play />
              Play
            </Button>
            <Button size="lg" variant="secondary" onClick={onRules}>
              <BookOpen />
              How to play
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}