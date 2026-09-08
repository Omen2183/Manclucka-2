import { useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCw, Volume2, VolumeX } from "lucide-react";
import { Board } from "@/components/game/Board";
import { Button } from "@/components/ui/button";
import { chooseAiMove, thinkMs } from "@/game/ai";
import {
  isMuted,
  playExtraTurn,
  playIllegal,
  playLose,
  playRooster,
  playScared,
  playSow,
  playWin,
  rumble,
  setMuted,
  unlockAudio,
} from "@/game/audio";
import { breedFor } from "@/game/breeds";
import { cloneState, initialState, legalPits, scoreOf, sideSum, storeOf, tryMove, winsNeeded } from "@/game/engine";
import { keyRow } from "@/game/board-view";
import { RULE_LABELS } from "@/game/names";
import { usePlayOrientation } from "@/game/use-orientation";
import type { Difficulty, GameState, MatchSettings, Player } from "@/game/types";
import { loadTipped, saveTipped } from "@/lib/persist";
import { cn } from "@/lib/utils";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function prefersReduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function pitPoint(pit: number) {
  const el = document.querySelector<HTMLElement>(`[data-pit="${pit}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function PlayScreen({
  settings,
  names,
  south,
  humanPlayers,
  aiPlayer,
  scores,
  gameIndex,
  onBack,
  onGameOver,
  onMoveCommitted,
  incomingMoves = [],
}: {
  settings: MatchSettings;
  names: [string, string];
  south: Player;
  humanPlayers: ReadonlySet<Player>;
  aiPlayer: Player | null;
  scores: [number, number];
  gameIndex: number;
  onBack: () => void;
  onGameOver: (winner: Player | "draw", coops: [number, number]) => void;
  onMoveCommitted?: (pit: number, next: GameState) => void;
  incomingMoves?: { pit: number; seq: number }[];
}) {
  const [state, setState] = useState<GameState>(() => initialState(settings.rules, 0));
  const [busy, setBusy] = useState(false);
  const [lastFrom, setLastFrom] = useState<number | null>(null);
  const [dropping, setDropping] = useState<number | null>(null);
  const [lastLand, setLastLand] = useState<number | null>(null);
  const [extraFor, setExtraFor] = useState<Player | null>(null);
  const [shake, setShake] = useState(false);
  const [muted, setMutedUi] = useState(isMuted);
  const [banner, setBanner] = useState("");
  const [plies, setPlies] = useState(0);
  const [fly, setFly] = useState<{ src: string; x: number; y: number } | null>(null);
  const [tip, setTip] = useState(() => !loadTipped());
  const [handoff, setHandoff] = useState<Player | null>(null);
  const playing = useRef(false);
  const alive = useRef(true);
  const { nativeLandscape, landscape, cssRotate, flipped, toggleFlip } = usePlayOrientation();

  const appliedIncoming = useRef(-1);
  const endedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const hotseat = settings.mode === "hotseat";
  const need = winsNeeded(settings.bestOf);
  const yourTurn = humanPlayers.has(state.turn) && !busy && !state.ended && handoff == null;
  const legal = yourTurn ? legalPits(state) : [];
  const gathering =
    settings.rules === "until-empty" && yourTurn && sideSum(state.pits, state.turn) === 0 && legal.length > 0;

  useEffect(() => {
    alive.current = true;
    unlockAudio();
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("play-flipped", cssRotate);
    return () => document.documentElement.classList.remove("play-flipped");
  }, [cssRotate]);

  useEffect(() => {
    if (state.ended) return;
    if (aiPlayer !== state.turn) return;
    if (handoff != null) return;
    let cancelled = false;
    void (async () => {
      await sleep(40);
      if (cancelled || playing.current || endedRef.current || !alive.current) return;
      await runAi(stateRef.current, settings.difficulty);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plies, state.turn, state.ended, aiPlayer, settings.difficulty, handoff]);

  useEffect(() => {
    const next = incomingMoves.find((m) => m.seq > appliedIncoming.current);
    if (!next) return;
    if (playing.current) return;
    appliedIncoming.current = next.seq;
    void animateMove(next.pit, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingMoves, plies, busy]);

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (!yourTurn || playing.current) return;
      const match = ev.key.match(/^[1-6]$/);
      if (!match) return;
      const idx = Number(match[0]) - 1;
      const pit = keyRow(south, state.turn, gathering)[idx];
      if (pit == null) return;
      ev.preventDefault();
      handlePick(pit);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yourTurn, gathering, state.turn, south, state]);

  async function animateMove(pit: number, broadcast: boolean) {
    if (playing.current || endedRef.current) return;
    const current = stateRef.current;
    const planned = tryMove(current, pit);
    if (!planned) {
      playIllegal();
      rumble(8);
      return;
    }

    playing.current = true;
    setBusy(true);
    setLastFrom(pit);
    setLastLand(null);
    setExtraFor(null);
    if (tip) {
      setTip(false);
      saveTipped();
    }

    const visual = cloneState(current);
    visual.pits[pit] = 0;
    setState({ ...visual, pits: visual.pits.slice() });

    const reduced = prefersReduced();
    const step = reduced ? 0 : 130;
    const hen = breedFor(pit, 0);
    let from = pitPoint(pit);

    for (const dest of planned.drops) {
      if (!alive.current) return;
      const destPt = pitPoint(dest);
      setDropping(dest);
      if (!reduced && from && destPt) {
        setFly({ src: hen.src, x: from.x, y: from.y });
        await sleep(16);
        setFly({ src: hen.src, x: destPt.x, y: destPt.y });
        playSow();
        rumble(7);
        await sleep(step);
      } else {
        playSow();
        if (step) await sleep(step);
      }
      visual.pits[dest]! += 1;
      setState({ ...visual, pits: visual.pits.slice() });
      from = destPt ?? from;
    }
    setFly(null);
    setDropping(null);
    setLastLand(planned.drops[planned.drops.length - 1] ?? null);

    if (planned.capture) {
      if (!alive.current) return;
      const oppPt = pitPoint(planned.capture.opposite);
      const coopPt = pitPoint(storeOf(current.turn));
      const stolenHen = breedFor(planned.capture.opposite, 0);
      if (!reduced && oppPt && coopPt) {
        setFly({ src: stolenHen.src, x: oppPt.x, y: oppPt.y });
        await sleep(20);
        setFly({ src: stolenHen.src, x: coopPt.x, y: coopPt.y });
        await sleep(step + 90);
      }
      visual.pits[planned.capture.land] = 0;
      visual.pits[planned.capture.opposite] = 0;
      visual.pits[storeOf(current.turn)]! += planned.capture.amount;
      setState({ ...visual, pits: visual.pits.slice() });
      setFly(null);
      if (hotseat || current.turn === south) playRooster();
      else playScared();
      rumble(36);
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      if (step) await sleep(220);
    }

    if (!alive.current) return;
    setState(planned.state);
    stateRef.current = planned.state;

    if (planned.extraTurn) {
      playExtraTurn();
      rumble(14);
      setExtraFor(planned.state.turn);
      setBanner("Extra turn — the coop calls you back");
      if (aiPlayer === planned.state.turn && step) await sleep(700);
    } else {
      setBanner("");
    }

    if (broadcast) onMoveCommitted?.(pit, planned.state);

    setPlies((n) => n + 1);

    if (planned.state.ended) {
      endedRef.current = true;
      const coops: [number, number] = [scoreOf(planned.state, 0), scoreOf(planned.state, 1)];
      if (planned.state.winner === south) {
        playWin();
        rumble(50);
      } else if (planned.state.winner === "draw") {
        playExtraTurn();
      } else {
        playLose();
        rumble(28);
      }
      playing.current = false;
      setBusy(false);
      await sleep(reduced ? 120 : 420);
      if (!alive.current) return;
      onGameOver(planned.state.winner ?? "draw", coops);
      return;
    }

    playing.current = false;
    setBusy(false);

    if (hotseat && !planned.extraTurn && planned.state.turn !== current.turn) {
      setHandoff(planned.state.turn);
    }
  }

  async function runAi(current: GameState, difficulty: Difficulty) {
    if (playing.current || !alive.current) return;
    setBusy(true);
    setBanner(`${names[current.turn]} is thinking`);
    const started = performance.now();
    const pit = chooseAiMove(current, difficulty);
    const wait = Math.max(0, thinkMs(difficulty) - (performance.now() - started));
    if (wait && !prefersReduced()) await sleep(wait);
    if (!alive.current || pit == null) {
      setBusy(false);
      return;
    }
    playing.current = false;
    await animateMove(pit, true);
  }

  function handlePick(pit: number) {
    if (!yourTurn) return;
    if (!legalPits(state).includes(pit)) {
      playIllegal();
      rumble(8);
      return;
    }
    void animateMove(pit, true);
  }

  function acceptHandoff() {
    setHandoff(null);
  }

  const status = state.ended
    ? state.winner === "draw"
      ? "The flock split evenly"
      : `${names[state.winner!]} takes this game`
    : banner
      ? banner
      : gathering
        ? `${names[state.turn]} — yards empty, pick from the other side`
        : tip && yourTurn
          ? "Tap a glowing yard to sow"
          : yourTurn
            ? `${names[state.turn]} — pick a yard`
            : `${names[state.turn]}'s turn`;

  const scoreOrder: Player[] = [south, south === 0 ? 1 : 0];
  const vertical = !landscape;

  return (
    <div
      className={cn(
        "relative flex flex-col bg-bg play-root",
        cssRotate ? "play-rotate-landscape" : "h-dvh w-full overflow-hidden",
        landscape ? "play-landscape" : "play-portrait",
      )}
    >
      {fly && (
        <img
          src={fly.src}
          alt=""
          className="fly-hen"
          style={{ left: fly.x - 19, top: fly.y - 19 }}
          crossOrigin="anonymous"
        />
      )}
      <div className="play-shell">
        <header className="play-hud">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Leave match">
            <ArrowLeft />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base leading-tight sm:text-lg">{RULE_LABELS[settings.rules]}</p>
            <p className="truncate text-[11px] text-muted">
              Best of {settings.bestOf} · first to {need} · game {gameIndex + 1}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {scoreOrder.map((p) => (
              <div
                key={p}
                className={cn(
                  "rounded-md border border-border bg-surface px-2 py-1",
                  state.turn === p && !state.ended && "ring-2 ring-primary/50",
                )}
              >
                <p className="max-w-16 truncate text-[10px] text-muted sm:max-w-24">{names[p]}</p>
                <p className="font-display text-sm tabular-nums leading-none sm:text-base">
                  {scores[p]}
                  <span className="text-[10px] text-muted">/{need}</span>
                </p>
              </div>
            ))}
          </div>
          {!nativeLandscape && (
            <Button
              variant={flipped ? "secondary" : "ghost"}
              size="icon"
              aria-label={flipped ? "Upright board" : "Wide board"}
              aria-pressed={flipped}
              onClick={toggleFlip}
            >
              <RotateCw className={cn(flipped && "rotate-90")} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              setMutedUi(next);
            }}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
        </header>

        <p className="play-status" role="status">
          {status}
        </p>

        <div className={cn("board-stage", shake && "shake")}>
          <Board
            state={state}
            south={south}
            legal={legal}
            lastFrom={lastFrom}
            dropping={dropping}
            lastLand={lastLand}
            disabled={!yourTurn}
            names={names}
            extraFor={extraFor}
            vertical={vertical}
            onPick={handlePick}
          />
        </div>
      </div>

      {handoff != null && (
        <div className="play-end">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 text-center shadow-lg">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">pass the device</p>
            <p className="mt-1 font-display text-2xl">{names[handoff]}'s turn</p>
            <p className="mt-1 text-sm text-muted">Same board. Same sides. Just hand the phone over.</p>
            <Button size="lg" className="mt-4 w-full" onClick={acceptHandoff}>
              I'm {names[handoff]}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
