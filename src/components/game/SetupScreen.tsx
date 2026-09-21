import { ArrowLeft, Loader2, Shuffle, Swords, User, Users, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { FarmScene } from "@/components/game/FarmScene";
import { MixerButton } from "@/components/game/MixerButton";
import { difficultyBlurb, difficultyLabel, pickOpponentName, RULE_LABELS, RULE_TEASERS, yardBrief } from "@/game/names";
import { clampDifficulty, type BestOf, type MatchSettings, type PlayMode, type RuleSet } from "@/game/types";
import { cn, NAME_MAX } from "@/lib/utils";

const MODES: { id: PlayMode; label: string; blurb: string; icon: typeof User }[] = [
  { id: "solo", label: "Solo", blurb: "You against a named hen from the yard", icon: User },
  { id: "hotseat", label: "Pass & play", blurb: "Two keepers, one device", icon: Users },
  { id: "online", label: "Online", blurb: "Host or join with a flock code", icon: Wifi },
];

const RULES: RuleSet[] = ["classic", "first-empty", "until-empty"];
const SERIES: BestOf[] = [1, 3, 5, 7];

export function SetupScreen({
  settings,
  joinCode,
  joinError,
  joining,
  onChange,
  onJoinCode,
  onBack,
  onStart,
  onJoin,
}: {
  settings: MatchSettings;
  joinCode: string;
  joinError: string | null;
  joining: boolean;
  onChange: (patch: Partial<MatchSettings>) => void;
  onJoinCode: (code: string) => void;
  onBack: () => void;
  onStart: () => void;
  onJoin: () => void;
}) {
  return (
    <FarmScene>
      <div className="mx-auto flex h-dvh w-full max-w-lg flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
          <Button variant="secondary" className="w-fit" onClick={onBack}>
            <ArrowLeft />
            Back
          </Button>
          <MixerButton className="farm-panel rounded-md" />
        </div>
        <div className="farm-card min-h-0 flex-1 overflow-y-auto rounded-2xl px-4 py-5 sm:px-5">
          <h1 className="font-display text-3xl">Set the yard</h1>

          <div className="mt-5 space-y-6">
            <div>
              <Label htmlFor="player-name">Coop name</Label>
              <Input
                id="player-name"
                className="mt-1.5"
                maxLength={NAME_MAX}
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                placeholder="optional — shown on your coop"
                value={settings.playerName}
                onChange={(e) => onChange({ playerName: e.target.value.slice(0, NAME_MAX) })}
              />
              <p className="mt-1 text-xs text-muted">Leave blank and the coop just says You. Pick any handle you like.</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted">Play</p>
              <div className="mt-2 grid gap-1.5">
                {MODES.map((mode) => {
                  const Icon = mode.icon;
                  const active = settings.mode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onChange({ mode: mode.id })}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                        active ? "border-primary farm-panel" : "border-border bg-surface/70 hover:bg-surface",
                      )}
                    >
                      <Icon className="mt-0.5 size-5 text-primary" />
                      <span>
                        <span className="block font-medium">{mode.label}</span>
                        <span className="block text-sm text-muted">{mode.blurb}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {settings.mode === "hotseat" && (
              <div>
                <Label htmlFor="friend">Other keeper</Label>
                <Input
                  id="friend"
                  className="mt-1.5"
                  maxLength={NAME_MAX}
                  autoComplete="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  placeholder="e.g. Thatch"
                  value={settings.friendName}
                  onChange={(e) => onChange({ friendName: e.target.value.slice(0, NAME_MAX) })}
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      onChange({
                        friendName: pickOpponentName(settings.friendName, settings.playerName),
                      })
                    }
                  >
                    <Shuffle />
                    Shuffle
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => onChange({ friendName: "" })}
                  >
                    Clear
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted">This name sits on the far coop. Blank reads Friend.</p>
              </div>
            )}

            {settings.mode === "solo" && (
              <div>
                <Label htmlFor="rival-name">Rival hen</Label>
                <Input
                  id="rival-name"
                  className="mt-1.5"
                  maxLength={NAME_MAX}
                  autoComplete="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  placeholder="optional — or shuffle a hen"
                  value={settings.friendName}
                  onChange={(e) => onChange({ friendName: e.target.value.slice(0, NAME_MAX) })}
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      onChange({
                        friendName: pickOpponentName(settings.friendName, settings.playerName),
                      })
                    }
                  >
                    <Shuffle />
                    Shuffle
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className={cn(!settings.friendName && "border-primary ring-2 ring-primary/40")}
                    aria-pressed={!settings.friendName}
                    onClick={() => onChange({ friendName: "" })}
                  >
                    Surprise me
                  </Button>
                </div>
              </div>
            )}

            {settings.mode === "solo" && (
              <div>
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <span className="text-sm text-muted">{difficultyLabel(settings.difficulty)}</span>
                </div>
                <Slider
                  id="difficulty"
                  className="mt-3"
                  min={1}
                  max={5}
                  step={0.5}
                  value={[settings.difficulty]}
                  aria-valuetext={difficultyLabel(settings.difficulty)}
                  onValueChange={([v]) => onChange({ difficulty: clampDifficulty(v ?? 3) })}
                />
                <div className="mt-1 grid grid-cols-5 text-[0.62rem] leading-tight text-subtle">
                  <span className="text-left">Hatchling</span>
                  <span className="text-center">Pullet</span>
                  <span className="text-center">Hen</span>
                  <span className="text-center">Rooster</span>
                  <span className="text-right">Boss</span>
                </div>
                <p className="mt-2 text-sm text-muted">{difficultyBlurb(settings.difficulty)}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-muted">Rules</p>
              <div className="mt-2 grid gap-2">
                {RULES.map((rule) => {
                  const active = settings.rules === rule;
                  return (
                    <button
                      key={rule}
                      type="button"
                      onClick={() => onChange({ rules: rule })}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-left transition-colors",
                        active ? "border-primary farm-panel" : "border-border bg-surface/70 hover:bg-surface",
                      )}
                    >
                      <span className="block font-medium">{RULE_LABELS[rule]}</span>
                      <span className="mt-0.5 block text-sm text-muted">{RULE_TEASERS[rule]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted">Best of</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {SERIES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onChange({ bestOf: n })}
                    className={cn(
                      "h-11 rounded-md border text-sm font-medium",
                      settings.bestOf === n ? "border-primary farm-panel" : "border-border bg-surface/70",
                    )}
                  >
                    {n === 1 ? "One game" : n}
                  </button>
                ))}
              </div>
            </div>

            {settings.mode === "online" && (
              <div className="farm-panel rounded-xl p-4">
                <p className="text-sm font-medium">Join a flock</p>
                <p className="mt-1 text-sm text-muted">If a friend already hosted, enter their six-letter code.</p>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={joinCode}
                    maxLength={6}
                    aria-label="Flock code"
                    aria-invalid={joinError ? true : undefined}
                    aria-describedby={joinError ? "flock-code-error" : undefined}
                    className={cn(
                      "font-mono uppercase tracking-[0.2em]",
                      joinError && "ring-2 ring-[#8B2E1F]/70",
                    )}
                    placeholder="CODE"
                    onChange={(e) => onJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && joinCode.length === 6 && !joining) onJoin();
                    }}
                  />
                  <Button variant="secondary" disabled={joinCode.length < 6 || joining} onClick={onJoin}>
                    {joining ? <Loader2 className="animate-spin" /> : null}
                    {joining ? "Checking" : "Join"}
                  </Button>
                </div>
                {joinError ? (
                  <p id="flock-code-error" role="alert" className="mt-2 text-sm font-medium text-[#8B2E1F]">
                    {joinError}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className="farm-dock -mx-4 shrink-0 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="mb-2 truncate text-center text-xs text-muted">
            {yardBrief({
              you: settings.playerName,
              rival: settings.friendName,
              mode: settings.mode,
              difficulty: settings.difficulty,
              rules: settings.rules,
              bestOf: settings.bestOf,
            })}
          </p>
          <Button
            size="lg"
            className="w-full"
            onClick={settings.mode === "online" && joinCode.length === 6 ? onJoin : onStart}
            disabled={joining}
          >
            {joining ? <Loader2 className="animate-spin" /> : <Swords />}
            {joining
              ? "Checking"
              : settings.mode === "online" && joinCode.length === 6
                ? "Join flock"
                : settings.mode === "online"
                  ? "Host a flock"
                  : "Start"}
          </Button>
        </div>
      </div>
    </FarmScene>
  );
}
