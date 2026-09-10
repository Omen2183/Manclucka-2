import { BookOpen, Play } from "lucide-react";
import { HenMark } from "@/components/HenMark";
import { FarmScene } from "@/components/game/FarmScene";
import { MixerButton } from "@/components/game/MixerButton";
import { Button } from "@/components/ui/button";
import { loadStats, type MatchSnapshot } from "@/lib/persist";
import { useMemo } from "react";

export function MenuScreen({
  onPlay,
  onRules,
  resume,
  onResume,
  onScatter,
}: {
  onPlay: () => void;
  onRules: () => void;
  resume?: MatchSnapshot | null;
  onResume?: () => void;
  onScatter?: () => void;
}) {
  const stats = useMemo(() => loadStats(), []);

  return (
    <FarmScene hero>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-end px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(6.5rem,env(safe-area-inset-top))] sm:justify-center">
        <div className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))]">
          <MixerButton className="farm-panel rounded-md" />
        </div>

        <div className="farm-card overflow-hidden rounded-2xl">
          <div className="px-5 pb-6 pt-5">
            <div className="flex items-center gap-2 text-primary">
              <HenMark className="size-8" />
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">backyard kalah</p>
            </div>
            <h1 className="mt-2 font-display text-4xl tracking-[-0.03em] text-fg sm:text-5xl">Manclucka 2</h1>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
              Sow your Orpingtons around the fenced yards. Land in your coop for another turn. A friendly capture
              crows the rooster; when the other side steals your hens, they panic.
            </p>
            {stats.played > 0 && (
              <p className="mt-3 text-sm text-muted">
                {stats.won} series win{stats.won === 1 ? "" : "s"} · {stats.played} series played
              </p>
            )}
            {resume ? (
              <div className="farm-panel mt-4 rounded-xl p-3">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">parked match</p>
                <p className="mt-1 font-display text-xl">
                  {resume.names[0]} vs {resume.names[1]}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {resume.settings.bestOf === 1
                    ? "Single game"
                    : `${resume.scores[0]}–${resume.scores[1]} · best of ${resume.settings.bestOf}`}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Button size="lg" onClick={onResume}>
                    Resume match
                  </Button>
                  <Button size="lg" variant="secondary" onClick={onScatter}>
                    Scatter the flock
                  </Button>
                </div>
              </div>
            ) : null}
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
    </FarmScene>
  );
}
