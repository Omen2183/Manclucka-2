import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Board } from "@/components/game/Board";
import { Button } from "@/components/ui/button";
import { MixerButton } from "@/components/game/MixerButton";
import { chooseAiMove, thinkMs } from "@/game/ai";
import {
  playExtraTurn,
  playIllegal,
  playLose,
  playRooster,
  playScared,
  playSow,
  playWin,
  rumble,
  unlockAudio,
} from "@/game/audio";
import { breedFor } from "@/game/breeds";
import {
  cloneState,
  initialState,
  isYard,
  legalPits,
  leftoverHolder,
  pitsOf,
  scoreOf,
  sideSum,
  storeOf,
  tryMove,
  winsNeeded,
} from "@/game/engine";
import { keyRow } from "@/game/board-view";
import { displayTakes, displayTurn, HOW_TO_STEPS, RULE_BLURBS, RULE_LABELS } from "@/game/names";
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
  onPark,
  onGameOver,
  onMoveCommitted,
  incomingMoves = [],
  seed,
  onBoardSettled,
  tallyEnded = true,
  online = false,
  incomingBase = 0,
  incomingReset = 0,
}: {
  settings: MatchSettings;
  names: [string, string];
  south: Player;
  humanPlayers: ReadonlySet<Player>;
  aiPlayer: Player | null;
  scores: [number, number];
  gameIndex: number;
  onBack: () => void;
  onPark?: () => void;
  onGameOver: (winner: Player | "draw", coops: [number, number]) => void;
  onMoveCommitted?: (pit: number, next: GameState) => void;
  incomingMoves?: { pit: number; seq: number }[];
  seed?: GameState;
  onBoardSettled?: (next: GameState) => void;
  tallyEnded?: boolean;
  online?: boolean;
  incomingBase?: number;
  incomingReset?: number;
}) {
  const [state, setState] = useState<GameState>(() => seed ?? initialState(settings.rules, 0));
  const [busy, setBusy] = useState(false);
  const [lastFrom, setLastFrom] = useState<number | null>(null);
  const [dropping, setDropping] = useState<number | null>(null);
  const [lastLand, setLastLand] = useState<number | null>(null);
  const [extraFor, setExtraFor] = useState<Player | null>(null);
  const [shake, setShake] = useState(false);
  const [banner, setBanner] = useState("");
  const [plies, setPlies] = useState(0);
  const [fly, setFly] = useState<{ src: string; x: number; y: number } | null>(null);
  const [tip, setTip] = useState(() => !loadTipped());
  const [handoff, setHandoff] = useState<Player | null>(null);
  const [trail, setTrail] = useState<number[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [hurrying, setHurrying] = useState(false);
  const [capturePop, setCapturePop] = useState<{ player: Player; amount: number } | null>(null);
  const playing = useRef(false);
  const alive = useRef(true);
  const lastPickAt = useRef(0);
  const hurryRef = useRef(false);
  const aiGen = useRef(0);
  const { nativeLandscape, landscape, cssRotate, flipped, toggleFlip } = usePlayOrientation();

  const appliedIncoming = useRef(incomingBase);
  const endedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const captureTimer = useRef<number | null>(null);

  const hotseat = settings.mode === "hotseat";
  const need = winsNeeded(settings.bestOf);
  const blocked = confirmLeave || handoff != null || rulesOpen;
  const yourTurn = humanPlayers.has(state.turn) && !busy && !state.ended && !blocked;
  const legal = yourTurn ? legalPits(state) : [];
  const gathering =
    state.rules === "until-empty" && yourTurn && sideSum(state.pits, state.turn) === 0 && legal.length > 0;
  const hintPit =
    plies === 0 &&
    yourTurn &&
    settings.rules === "classic" &&
    !state.ended &&
    pitsOf(south)[2] != null
      ? pitsOf(south)[2]!
      : null;

  useEffect(() => {
    alive.current = true;
    document.documentElement.classList.add("play-root-lock");
    return () => {
      alive.current = false;
      document.documentElement.classList.remove("play-root-lock");
      if (captureTimer.current) window.clearTimeout(captureTimer.current);
    };
  }, []);

  useEffect(() => {
    appliedIncoming.current = incomingBase;
    // Only on new game / sync — never when we send a local sow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingReset]);

  useEffect(() => {
    if (!seed?.ended || endedRef.current || !tallyEnded) return;
    endedRef.current = true;
    onGameOver(seed.winner ?? "draw", [scoreOf(seed, 0), scoreOf(seed, 1)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const opening =
      !seed ||
      seed.pits.every((n, i) => n === (i === 6 || i === 13 ? 0 : 4));
    if (state.ended || plies !== 0 || tip || !opening) return;
    setBanner(`${names[state.turn]} opens the gate`);
    playExtraTurn();
    rumble(14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hotseat && gameIndex > 0 && humanPlayers.size > 1) {
      setHandoff(stateRef.current.turn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("play-flipped", cssRotate);
    return () => document.documentElement.classList.remove("play-flipped");
  }, [cssRotate]);

  useEffect(() => {
    if (state.ended) return;
    if (aiPlayer !== state.turn) return;
    if (blocked) return;
    const gen = ++aiGen.current;
    let cancelled = false;
    void (async () => {
      await sleep(40);
      if (cancelled || gen !== aiGen.current || playing.current || endedRef.current || !alive.current) return;
      await runAi(stateRef.current, settings.difficulty, () => cancelled || gen !== aiGen.current);
    })();
    return () => {
      cancelled = true;
      aiGen.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plies, state.turn, state.ended, aiPlayer, settings.difficulty, blocked]);

  useEffect(() => {
    if (playing.current || busy) return;
    if (humanPlayers.has(stateRef.current.turn)) return;
    const expected = appliedIncoming.current + 1;
    const next = incomingMoves.find((m) => m.seq === expected);
    if (!next) return;
    appliedIncoming.current = expected;
    void animateMove(next.pit, false).then((ok) => {
      if (!ok && alive.current) {
        appliedIncoming.current = expected - 1;
        setBanner("Yard desynced — wait for the next sow");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingMoves, plies, busy]);

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        if (rulesOpen) {
          setRulesOpen(false);
          return;
        }
        if (confirmLeave) {
          setConfirmLeave(false);
          return;
        }
      }
      if (ev.key === " " && (playing.current || busy) && !blocked) {
        ev.preventDefault();
        hurryRef.current = true;
        setHurrying(true);
        return;
      }
      if (!yourTurn || playing.current) return;
      if (blocked) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
      if (ev.target instanceof HTMLElement && ev.target.closest("input, textarea, select, [role='dialog']")) return;
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
  }, [yourTurn, gathering, state.turn, south, state, confirmLeave, handoff, rulesOpen, busy]);

  function requestHurry() {
    if (blocked) return;
    if (playing.current || busy) {
      hurryRef.current = true;
      setHurrying(true);
    }
  }

  async function animateMove(pit: number, broadcast: boolean): Promise<boolean> {
    if (playing.current || endedRef.current) return false;
    const current = stateRef.current;
    const planned = tryMove(current, pit);
    if (!planned) {
      if (broadcast) {
        playIllegal();
        rumble(8);
      }
      return false;
    }

    playing.current = true;
    setBusy(true);
    setTrail(planned.drops);
    try {
      await runSow(current, planned, pit, broadcast);
      if (broadcast && alive.current) appliedIncoming.current += 1;
      return true;
    } catch {
      if (alive.current) {
        setState(planned.state);
        stateRef.current = planned.state;
        onBoardSettled?.(planned.state);
      } else {
        onBoardSettled?.(planned.state);
        if (broadcast) onMoveCommitted?.(pit, planned.state);
      }
      if (broadcast) appliedIncoming.current += 1;
      return true;
    } finally {
      playing.current = false;
      hurryRef.current = false;
      lastPickAt.current = 0;
      if (alive.current) {
        setBusy(false);
        setHurrying(false);
      }
    }
  }

  async function runSow(
    current: GameState,
    planned: NonNullable<ReturnType<typeof tryMove>>,
    pit: number,
    broadcast: boolean,
  ) {
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

    const hen = breedFor(pit, 0);
    let from = pitPoint(pit);

    function commitIfGone() {
      if (alive.current) return false;
      onBoardSettled?.(planned.state);
      if (broadcast) onMoveCommitted?.(pit, planned.state);
      if (planned.state.ended && !endedRef.current) {
        endedRef.current = true;
        onGameOver(planned.state.winner ?? "draw", [
          scoreOf(planned.state, 0),
          scoreOf(planned.state, 1),
        ]);
      }
      return true;
    }

    for (const dest of planned.drops) {
      if (commitIfGone()) return;
      const skipAnim = prefersReduced() || hurryRef.current;
      const destPt = pitPoint(dest);
      setDropping(dest);
      if (!skipAnim && from && destPt) {
        setFly({ src: hen.src, x: from.x, y: from.y });
        await sleep(16);
        if (commitIfGone()) return;
        setFly({ src: hen.src, x: destPt.x, y: destPt.y });
        playSow();
        rumble(7);
        await sleep(130);
        if (commitIfGone()) return;
      } else {
        playSow();
        if (!skipAnim) await sleep(130);
        if (commitIfGone()) return;
      }
      visual.pits[dest]! += 1;
      setState({ ...visual, pits: visual.pits.slice() });
      from = destPt ?? from;
    }
    setFly(null);
    setDropping(null);
    setLastLand(planned.drops[planned.drops.length - 1] ?? null);

    if (planned.capture) {
      if (commitIfGone()) return;
      const skipAnim = prefersReduced() || hurryRef.current;
      const oppPt = pitPoint(planned.capture.opposite);
      const coopPt = pitPoint(storeOf(current.turn));
      const stolenHen = breedFor(planned.capture.opposite, 0);
      if (!skipAnim && oppPt && coopPt) {
        setFly({ src: stolenHen.src, x: oppPt.x, y: oppPt.y });
        await sleep(20);
        if (commitIfGone()) return;
        setFly({ src: stolenHen.src, x: coopPt.x, y: coopPt.y });
        await sleep(220);
        if (commitIfGone()) return;
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
      setCapturePop({ player: current.turn, amount: planned.capture.amount });
      if (captureTimer.current) window.clearTimeout(captureTimer.current);
      captureTimer.current = window.setTimeout(() => {
        captureTimer.current = null;
        if (alive.current) {
          setShake(false);
          setCapturePop(null);
        }
      }, 720);
      setBanner(
        current.turn === south
          ? `${names[current.turn]} calls ${planned.capture.amount} home`
          : `${names[current.turn]} steals ${planned.capture.amount}`,
      );
      if (!skipAnim) await sleep(220);
    }

    if (planned.state.ended && planned.emptiedSide != null && settings.rules !== "until-empty") {
      const holder = leftoverHolder(settings.rules, planned.emptiedSide, current.turn);
      const leftovers: number[] = [];
      for (let i = 0; i < visual.pits.length; i++) {
        if (isYard(i) && visual.pits[i]! > 0 && planned.state.pits[i] === 0) leftovers.push(i);
      }
      if (leftovers.length) {
        setBanner(
          settings.rules === "first-empty"
            ? `${names[holder]} claims the leftover flock`
            : `${names[holder]} takes the leftover flock`,
        );
        const destPt = pitPoint(storeOf(holder));
        const skipAnim = prefersReduced() || hurryRef.current;
        for (const yard of leftovers) {
          if (commitIfGone()) return;
          const srcPt = pitPoint(yard);
          const leftoverHen = breedFor(yard, 0);
          if (!skipAnim && srcPt && destPt) {
            setFly({ src: leftoverHen.src, x: srcPt.x, y: srcPt.y });
            await sleep(16);
            if (commitIfGone()) return;
            setFly({ src: leftoverHen.src, x: destPt.x, y: destPt.y });
            playSow();
            rumble(7);
            await sleep(110);
            if (commitIfGone()) return;
          }
          visual.pits[storeOf(holder)]! += visual.pits[yard]!;
          visual.pits[yard] = 0;
          setState({ ...visual, pits: visual.pits.slice() });
        }
        setFly(null);
      }
    }

    if (commitIfGone()) return;
    setState(planned.state);
    stateRef.current = planned.state;
    onBoardSettled?.(planned.state);

    if (planned.extraTurn) {
      playExtraTurn();
      rumble(14);
      setExtraFor(planned.state.turn);
      setBanner(`${names[planned.state.turn]} — extra turn`);
      if (aiPlayer === planned.state.turn && !prefersReduced() && !hurryRef.current) await sleep(500);
    } else if (!planned.capture && !(planned.state.ended && planned.emptiedSide != null)) {
      setBanner("");
    }

    if (broadcast) onMoveCommitted?.(pit, planned.state);

    setPlies((n) => n + 1);

    if (planned.state.ended) {
      endedRef.current = true;
      const coops: [number, number] = [scoreOf(planned.state, 0), scoreOf(planned.state, 1)];
      onGameOver(planned.state.winner ?? "draw", coops);
      if (hotseat || planned.state.winner === south) {
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
      await sleep(prefersReduced() || hurryRef.current ? 80 : 360);
      return;
    }

    playing.current = false;
    setBusy(false);

    if (hotseat && !planned.extraTurn && planned.state.turn !== current.turn) {
      setHandoff(planned.state.turn);
    }
  }

  async function runAi(current: GameState, difficulty: Difficulty, isCancelled: () => boolean) {
    if (playing.current || !alive.current) return;
    setBusy(true);
    setBanner(`${names[current.turn]} is thinking`);
    playExtraTurn();
    const started = performance.now();
    const pit = chooseAiMove(current, difficulty);
    const wait = Math.max(0, thinkMs(difficulty) - (performance.now() - started));
    const step = 40;
    let left = prefersReduced() ? 0 : wait;
    let cluckAt = 0;
    while (left > 0 && alive.current && !hurryRef.current && !isCancelled()) {
      const chunk = Math.min(step, left);
      await sleep(chunk);
      left -= chunk;
      cluckAt += chunk;
      if (cluckAt >= 380 && alive.current && !isCancelled()) {
        playSow();
        cluckAt = 0;
      }
    }
    if (!alive.current || isCancelled() || endedRef.current || stateRef.current.turn !== current.turn) {
      if (alive.current && !playing.current) setBusy(false);
      return;
    }
    if (pit == null) {
      if (alive.current) setBusy(false);
      return;
    }
    playing.current = false;
    const ok = await animateMove(pit, true);
    if (!ok && alive.current && !playing.current) setBusy(false);
  }

  function handlePick(pit: number) {
    if (!yourTurn || playing.current) return;
    if (!legalPits(state).includes(pit)) {
      playIllegal();
      rumble(8);
      setBanner("That yard isn't ready");
      return;
    }
    const now = performance.now();
    if (now - lastPickAt.current < 280) return;
    lastPickAt.current = now;
    void animateMove(pit, true);
  }

  function acceptHandoff() {
    setHandoff(null);
  }

  const status = state.ended
    ? state.winner === "draw"
      ? "Even flock"
      : state.winner == null
        ? "Even flock"
        : displayTakes(names[state.winner], "this game")
    : banner
      ? banner
      : gathering
        ? `${names[state.turn]} — yards empty, peck across the fence`
        : tip && yourTurn
          ? typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches
            ? "Tap a numbered yard to sow, or press 1–6"
            : "Tap a numbered yard to sow"
          : busy && !state.ended
            ? hurrying
              ? "Hurrying the flock"
              : "Tap to hurry the flock"
            : hotseat
              ? displayTurn(names[state.turn], false)
              : yourTurn
                ? displayTurn(names[state.turn], true)
                : displayTurn(names[state.turn], false);

  const scoreOrder: Player[] = [south, south === 0 ? 1 : 0];
  const vertical = !landscape;

  return (
    <div
      className={cn(
        "relative flex flex-col play-root",
        cssRotate ? "play-rotate-landscape" : "h-dvh w-full overflow-hidden",
        landscape ? "play-landscape" : "play-portrait",
      )}
      onPointerDown={() => {
        unlockAudio();
        requestHurry();
      }}
    >
      {fly &&
        createPortal(
          <img
            src={fly.src}
            alt=""
            className="fly-hen"
            style={{ left: fly.x - 19, top: fly.y - 19 }}
            crossOrigin="anonymous"
          />,
          document.body,
        )}
      <div className="play-shell">
        <header className="play-hud farm-panel rounded-lg px-1 py-0.5">
          <Button variant="ghost" size="icon" onClick={() => setConfirmLeave(true)} aria-label="Leave match">
            <ArrowLeft />
          </Button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="truncate text-left font-display text-base leading-tight sm:text-lg"
              onClick={() => setRulesOpen(true)}
              aria-label="How to play"
            >
              {RULE_LABELS[settings.rules]}
            </button>
            <p className="hidden truncate text-xs text-muted sm:block">
              {settings.bestOf === 1 ? "Single game" : `Best of ${settings.bestOf} · first to ${need} · game ${gameIndex + 1}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {scoreOrder.map((p) => (
              <div
                key={p}
                className={cn(
                  "farm-panel rounded-md px-2 py-1",
                  state.turn === p && !state.ended && "ring-2 ring-primary/50",
                )}
                aria-current={state.turn === p && !state.ended ? "true" : undefined}
              >
                <p className="max-w-16 truncate text-xs text-muted sm:max-w-24">{names[p]}</p>
                <p className="font-display text-sm tabular-nums leading-none sm:text-base">
                  {scores[p]}
                  <span className="text-xs text-muted">/{need}</span>
                </p>
                {settings.bestOf > 1 ? (
                  <p className="series-pips mt-0.5" aria-hidden="true">
                    {Array.from({ length: need }, (_, i) => (
                      <span key={i} className={i < scores[p] ? "pip-on" : "pip-off"} />
                    ))}
                  </p>
                ) : null}
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
          <MixerButton />
        </header>

        <p className="play-status farm-panel rounded-md" role="status" aria-live="polite" aria-atomic="true">
          <span>{status}</span>
          {busy && !state.ended && !blocked ? (
            <Button type="button" size="sm" variant="secondary" onClick={requestHurry}>
              Skip
            </Button>
          ) : null}
        </p>

        <div className={cn("board-stage", shake && "shake")}>
          <Board
            state={state}
            south={south}
            legal={legal}
            lastFrom={lastFrom}
            dropping={dropping}
            lastLand={lastLand}
            trail={trail}
            disabled={!yourTurn}
            names={names}
            extraFor={extraFor}
            vertical={vertical}
            capturePop={capturePop}
            gathering={gathering}
            hintPit={hintPit}
            onPick={handlePick}
          />
        </div>
      </div>

      {handoff != null && (
        <div className="play-end">
          <div
            className="farm-card w-full max-w-md rounded-xl p-5 text-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="handoff-title"
            tabIndex={-1}
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">pass the device</p>
            <p id="handoff-title" className="mt-1 font-display text-2xl">{names[handoff]}'s turn</p>
            <p className="mt-1 text-sm text-muted">Same board. Same sides. Just hand the phone over.</p>
            <Button size="lg" className="mt-4 w-full" autoFocus onClick={acceptHandoff}>
              I'm {names[handoff]}
            </Button>
          </div>
        </div>
      )}

      {rulesOpen && (
        <div className="play-end">
          <div
            className="farm-card w-full max-w-md rounded-xl p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="play-rules-title"
            tabIndex={-1}
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">how to play</p>
            <p id="play-rules-title" className="mt-1 font-display text-2xl">
              {RULE_LABELS[settings.rules]}
            </p>
            <ol className="mt-3 space-y-2 text-sm leading-relaxed">
              {HOW_TO_STEPS.map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="font-display text-primary">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-muted">{RULE_BLURBS[settings.rules]}</p>
            <Button size="lg" className="mt-4 w-full" autoFocus onClick={() => setRulesOpen(false)}>
              Back to the yards
            </Button>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div className="play-end">
          <div
            className="farm-card w-full max-w-md rounded-xl p-5 text-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            tabIndex={-1}
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">leave the yard</p>
            <p id="leave-title" className="mt-1 font-display text-2xl">
              {online ? "Leave this flock?" : "Keep this match?"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {online
                ? "Scatter forfeits the series. The link drops if you leave."
                : "Park the yard to resume later. Scatter to start clean."}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button size="lg" autoFocus onClick={() => setConfirmLeave(false)}>
                Stay
              </Button>
              {onPark ? (
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => {
                    setConfirmLeave(false);
                    onPark();
                  }}
                >
                  Park the yard
                </Button>
              ) : null}
              <Button
                size="lg"
                variant="secondary"
                onClick={() => {
                  setConfirmLeave(false);
                  onBack();
                }}
              >
                {online ? "Forfeit and leave" : "Scatter the flock"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
