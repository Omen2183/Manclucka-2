import { useMemo } from "react";
import { breedFor, COOP_SRC } from "@/game/breeds";
import { sideSum, storeOf } from "@/game/engine";
import { northOrder, southOrder } from "@/game/board-view";
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
    const r = n <= 4 ? 14 : n <= 6 ? 16 : 18;
    return {
      x: 50 + Math.cos(angle) * r,
      y: 56 + Math.sin(angle) * (r * 0.68),
      z: i,
      s: n > 6 ? 0.72 : 0.82,
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
            decoding="async"
            className={cn("hen-pop absolute object-contain drop-shadow-sm", dim)}
            style={{
              left: `${pos.x - half}%`,
              top: `${pos.y - half * 0.9}%`,
              zIndex: pos.z,
              ["--hen-scale" as string]: String(pos.s),
              ["--hen-delay" as string]: `${(pit * 80 + i * 110) % 1200}ms`,
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

function PitYard({
  pit,
  slot,
  count,
  owner,
  legal,
  highlighted,
  dropping,
  landing,
  onTrail,
  forage,
  disabled,
  onPick,
}: {
  pit: number;
  slot: number;
  count: number;
  owner: string;
  legal: boolean;
  highlighted: boolean;
  dropping?: boolean;
  landing?: boolean;
  onTrail?: boolean;
  forage?: boolean;
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
          aria-label={`${owner} yard ${slot}, ${count} chickens${legal && !disabled ? ", ready to sow" : ""}`}
          className={cn(
            "yard relative min-h-11",
            "transition-transform duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)]",
            legal && !disabled && "hover:-translate-y-0.5 hover:brightness-110",
            legal && !disabled && "yard-legal",
            forage && "yard-forage",
            highlighted && "yard-hot",
            dropping && "yard-drop",
            landing && "yard-land",
            onTrail && !highlighted && !landing && "yard-trail",
            (!legal || disabled) && "cursor-default",
          )}
        >
          <span className="yard-soil" aria-hidden="true" />
          <Fence />
          <span className="pit-slot" aria-hidden="true">
            {slot}
          </span>
          <ChickenTokens pit={pit} count={count} />
        </button>
        <span className="pit-count" aria-hidden="true">
          {count}
        </span>
      </div>
    </div>
  );
}

function CoopStore({
  player,
  count,
  out,
  label,
  extra,
  active,
  end,
  capturePop,
}: {
  player: Player;
  count: number;
  out: number;
  label: string;
  extra: boolean;
  active?: boolean;
  end: "left" | "right" | "top" | "bottom";
  capturePop?: number | null;
}) {
  const pit = storeOf(player);
  return (
    <div
      data-pit={pit}
      data-end={end}
      className={cn("coop-house", extra && "coop-extra", active && !extra && "coop-turn")}
      role="img"
      aria-label={`${label} coop, ${count} in coop, ${out} in yards${extra ? ", extra turn" : active ? ", current turn" : ""}`}
    >
      {capturePop ? <span className="coop-pop">+{capturePop}</span> : null}
      <img src={COOP_SRC} alt="" className="coop-mark" decoding="async" crossOrigin="anonymous" />
      <div className="coop-copy">
        <p className="coop-name">{label}</p>
        <p className="coop-count">{count}</p>
        <p className="coop-kicker">{out > 0 ? `${out} in yards` : "yards bare"}</p>
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
  trail = [],
  disabled,
  names,
  extraFor,
  vertical,
  capturePop,
  gathering = false,
  hintPit = null,
  onPick,
}: {
  state: GameState;
  south: Player;
  legal: number[];
  lastFrom: number | null;
  dropping: number | null;
  lastLand: number | null;
  trail?: number[];
  disabled: boolean;
  names: [string, string];
  extraFor: Player | null;
  vertical: boolean;
  capturePop?: { player: Player; amount: number } | null;
  gathering?: boolean;
  hintPit?: number | null;
  onPick: (pit: number) => void;
}) {
  const north: Player = south === 0 ? 1 : 0;
  const northPits = northOrder(south);
  const southPits = southOrder(south);
  const legalSet = new Set(legal);

  function yard(pit: number, slot: number, owner: Player) {
    return (
      <PitYard
        key={pit}
        pit={pit}
        slot={slot}
        owner={names[owner]}
        count={state.pits[pit]!}
        legal={legalSet.has(pit)}
        highlighted={lastFrom === pit || hintPit === pit}
        dropping={dropping === pit}
        landing={lastLand === pit}
        onTrail={trail.includes(pit)}
        forage={gathering && legalSet.has(pit)}
        disabled={disabled}
        onPick={onPick}
      />
    );
  }

  return (
    <div className={cn("board-wrap", vertical ? "board-wrap-portrait" : "board-wrap-landscape")}>
      <div className="board-slab">
        <div className="board-inlay" aria-hidden="true" />
        <div className="board-rivets" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        {vertical ? (
          <div className="board-grid board-grid-portrait">
            <CoopStore
              player={north}
              count={state.pits[storeOf(north)]!}
              out={sideSum(state.pits, north)}
              label={names[north]}
              extra={extraFor === north}
              active={state.turn === north && !state.ended}
              capturePop={capturePop?.player === north ? capturePop.amount : null}
              end="top"
            />
            <div className="pit-band-portrait">
              {northPits.map((northPit, i) => (
                <div key={northPit} className="pit-pair">
                  {yard(northPit, i + 1, north)}
                  {yard(southPits[i]!, i + 1, south)}
                </div>
              ))}
            </div>
            <CoopStore
              player={south}
              count={state.pits[storeOf(south)]!}
              out={sideSum(state.pits, south)}
              label={names[south]}
              extra={extraFor === south}
              active={state.turn === south && !state.ended}
              capturePop={capturePop?.player === south ? capturePop.amount : null}
              end="bottom"
            />
          </div>
        ) : (
          <div className="board-grid board-grid-landscape">
            <CoopStore
              player={north}
              count={state.pits[storeOf(north)]!}
              out={sideSum(state.pits, north)}
              label={names[north]}
              extra={extraFor === north}
              active={state.turn === north && !state.ended}
              capturePop={capturePop?.player === north ? capturePop.amount : null}
              end="left"
            />
            <div className="pit-band">
              <div className="pit-row">{northPits.map((pit, i) => yard(pit, i + 1, north))}</div>
              <div className="board-groove" aria-hidden="true" />
              <div className="pit-row">{southPits.map((pit, i) => yard(pit, i + 1, south))}</div>
            </div>
            <CoopStore
              player={south}
              count={state.pits[storeOf(south)]!}
              out={sideSum(state.pits, south)}
              label={names[south]}
              extra={extraFor === south}
              active={state.turn === south && !state.ended}
              capturePop={capturePop?.player === south ? capturePop.amount : null}
              end="right"
            />
          </div>
        )}
      </div>
    </div>
  );
}
