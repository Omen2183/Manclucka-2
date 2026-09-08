import { useMemo } from "react";
import { breedFor, COOP_SRC } from "@/game/breeds";
import { storeOf } from "@/game/engine";
import type { GameState, Player } from "@/game/types";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 8;

function tokenLayout(count: number) {
  const n = Math.min(count, MAX_VISIBLE);
  if (n <= 0) return [];
  if (n === 1) return [{ x: 50, y: 56, z: 0, s: 1 }];
  if (n === 2) {
    return [
      { x: 36, y: 52, z: 0, s: 0.96 },
      { x: 64, y: 58, z: 1, s: 0.96 },
    ];
  }
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2.2;
    const r = n <= 4 ? 18 : n <= 6 ? 22 : 24;
    return {
      x: 50 + Math.cos(angle) * r,
      y: 56 + Math.sin(angle) * (r * 0.68),
      z: i,
      s: n > 6 ? 0.8 : 0.9,
    };
  });
}

function ChickenTokens({ pit, count, size }: { pit: number; count: number; size?: "pit" | "coop" }) {
  const layout = useMemo(() => tokenLayout(count), [count]);
  if (count <= 0) return null;
  const dim = size === "coop" ? "h-[38%] w-[38%]" : "h-[54%] w-[54%]";
  return (
    <div className="pointer-events-none yard-flock absolute inset-0 overflow-hidden">
      {layout.map((pos, i) => {
        const breed = breedFor(pit, i);
        const half = size === "coop" ? 19 : 27;
        return (
          <img
            key={`${pit}-${i}-${breed.id}`}
            src={breed.src}
            alt=""
            className={cn("hen-pop absolute object-contain drop-shadow-sm", dim)}
            style={{
              left: `${pos.x - half}%`,
              top: `${pos.y - half * 0.9}%`,
              zIndex: pos.z,
              ["--hen-scale" as string]: String(pos.s),
            }}
            crossOrigin="anonymous"
          />
        );
      })}
    </div>
  );
}

function Fence() {
  return (
    <div className="yard-fence" aria-hidden="true">
      <span className="yard-wire" />
      <span className="yard-rim" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <span
            key={deg}
            className="yard-post"
            style={{
              left: `${50 + Math.cos(rad) * 47}%`,
              top: `${50 + Math.sin(rad) * 47}%`,
            }}
          />
        );
      })}
    </div>
  );
}

export function PitYard({
  pit,
  count,
  legal,
  highlighted,
  dropping,
  landing,
  disabled,
  onPick,
}: {
  pit: number;
  count: number;
  legal: boolean;
  highlighted: boolean;
  dropping?: boolean;
  landing?: boolean;
  disabled: boolean;
  onPick: (pit: number) => void;
}) {
  return (
    <div className="pit-cell">
      <div className="yard-stack">
        <button
          type="button"
          data-pit={pit}
          disabled={disabled || !legal}
          onClick={() => onPick(pit)}
          aria-label={`Yard ${pit + 1}, ${count} chickens`}
          className={cn(
            "yard relative min-h-11",
            "transition-transform duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)]",
            legal && !disabled && "hover:-translate-y-0.5 hover:brightness-110",
            legal && !disabled && "yard-legal",
            highlighted && "yard-hot",
            dropping && "yard-drop",
            landing && "yard-land",
            (!legal || disabled) && "cursor-default",
          )}
        >
          <Fence />
          <ChickenTokens pit={pit} count={count} />
        </button>
        <span className="pit-count">{count}</span>
      </div>
    </div>
  );
}

export function CoopStore({
  player,
  count,
  label,
  extra,
  active,
  end,
}: {
  player: Player;
  count: number;
  label: string;
  extra: boolean;
  active?: boolean;
  end: "left" | "right" | "top" | "bottom";
}) {
  const pit = storeOf(player);
  return (
    <div
      data-pit={pit}
      data-end={end}
      className={cn("coop-house", extra && "coop-extra", active && !extra && "coop-turn")}
    >
      <img src={COOP_SRC} alt="" className="coop-mark" crossOrigin="anonymous" />
      <div className="coop-copy">
        <p className="coop-name">{label}</p>
        <p className="coop-count">{count}</p>
        <p className="coop-kicker">coop</p>
      </div>
      <div className="coop-yard">
        <ChickenTokens pit={pit} count={Math.min(count, 6)} size="coop" />
      </div>
    </div>
  );
}

export function Board({
  state,
  south,
  legal,
  lastFrom,
  dropping,
  lastLand,
  disabled,
  names,
  extraFor,
  vertical,
  onPick,
}: {
  state: GameState;
  south: Player;
  legal: number[];
  lastFrom: number | null;
  dropping: number | null;
  lastLand: number | null;
  disabled: boolean;
  names: [string, string];
  extraFor: Player | null;
  vertical: boolean;
  onPick: (pit: number) => void;
}) {
  const north: Player = south === 0 ? 1 : 0;
  const northPits = south === 0 ? [12, 11, 10, 9, 8, 7] : [5, 4, 3, 2, 1, 0];
  const southPits = south === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
  const legalSet = new Set(legal);

  function yard(pit: number) {
    return (
      <PitYard
        key={pit}
        pit={pit}
        count={state.pits[pit]!}
        legal={legalSet.has(pit)}
        highlighted={lastFrom === pit}
        dropping={dropping === pit}
        landing={lastLand === pit}
        disabled={disabled}
        onPick={onPick}
      />
    );
  }

  return (
    <div className={cn("board-wrap", vertical ? "board-wrap-portrait" : "board-wrap-landscape")}>
      <div className="board-slab">
        <div className="board-inlay" aria-hidden="true" />
        {vertical ? (
          <div className="board-grid board-grid-portrait">
            <CoopStore
              player={north}
              count={state.pits[storeOf(north)]!}
              label={names[north]}
              extra={extraFor === north}
              active={state.turn === north && !state.ended}
              end="top"
            />
            <div className="pit-band-portrait">
              {northPits.map((northPit, i) => (
                <div key={northPit} className="pit-pair">
                  {yard(northPit)}
                  {yard(southPits[i]!)}
                </div>
              ))}
            </div>
            <CoopStore
              player={south}
              count={state.pits[storeOf(south)]!}
              label={names[south]}
              extra={extraFor === south}
              active={state.turn === south && !state.ended}
              end="bottom"
            />
          </div>
        ) : (
          <div className="board-grid board-grid-landscape">
            <CoopStore
              player={north}
              count={state.pits[storeOf(north)]!}
              label={names[north]}
              extra={extraFor === north}
              active={state.turn === north && !state.ended}
              end="left"
            />
            <div className="pit-band">
              <div className="pit-row">{northPits.map((pit) => yard(pit))}</div>
              <div className="board-groove" aria-hidden="true" />
              <div className="pit-row">{southPits.map((pit) => yard(pit))}</div>
            </div>
            <CoopStore
              player={south}
              count={state.pits[storeOf(south)]!}
              label={names[south]}
              extra={extraFor === south}
              active={state.turn === south && !state.ended}
              end="right"
            />
          </div>
        )}
      </div>
    </div>
  );
}
