/** 24 coop-yard names, including the flock. */
export const OPPONENT_NAMES = [
  "Thatch",
  "Mumbles",
  "Buttercup",
  "Goldie",
  "Polo",
  "Oreo",
  "Tiger",
  "Pearl",
  "Karen",
  "Jaz",
  "Cluck Norris",
  "Henrietta",
  "Foghorn",
  "Speckles",
  "Nugget",
  "Biscuit",
  "Maple",
  "Marigold",
  "Cinnamon",
  "Honeycomb",
  "Peppermint",
  "Daisy",
  "Waffles",
  "Poppy",
] as const;

export function pickOpponentName(...exclude: Array<string | undefined | null>): string {
  const skip = new Set(
    exclude
      .map((n) => String(n ?? "").trim().toLowerCase())
      .filter((n) => n.length > 0),
  );
  const pool = OPPONENT_NAMES.filter((n) => !skip.has(n.toLowerCase()));
  const list = pool.length > 0 ? pool : [...OPPONENT_NAMES];
  return list[Math.floor(Math.random() * list.length)]!;
}

export const DIFFICULTY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Hatchling",
  2: "Pullet",
  3: "Hen",
  4: "Rooster",
  5: "Flock Boss",
};

export const DIFFICULTY_BLURBS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Pecks at random.",
  2: "Mostly wandering — notices a treat now and then.",
  3: "Goes for extra turns and captures, still leaves the gate open.",
  4: "Thinks a couple of turns out.",
  5: "The sharpest hen. Still beatable.",
};

export function difficultyLabel(level: number): string {
  if (level === 1 || level === 2 || level === 3 || level === 4 || level === 5) {
    return DIFFICULTY_LABELS[level];
  }
  const lo = Math.floor(level) as 1 | 2 | 3 | 4;
  const hi = Math.ceil(level) as 2 | 3 | 4 | 5;
  if (DIFFICULTY_LABELS[lo] && DIFFICULTY_LABELS[hi]) {
    return `${DIFFICULTY_LABELS[lo]}–${DIFFICULTY_LABELS[hi]}`;
  }
  return DIFFICULTY_LABELS[3];
}

export function difficultyBlurb(level: number): string {
  if (level === 1 || level === 2 || level === 3 || level === 4 || level === 5) {
    return DIFFICULTY_BLURBS[level];
  }
  return "A step between the named hens.";
}

export const RULE_LABELS: Record<"classic" | "first-empty" | "until-empty", string> = {
  classic: "Classic Kalah",
  "first-empty": "First empty",
  "until-empty": "Until empty",
};

export const RULE_TEASERS: Record<"classic" | "first-empty" | "until-empty", string> = {
  classic: "Extra turns, captures, leftovers to whoever still has hens.",
  "first-empty": "First to clear their yards claims the leftover flock.",
  "until-empty": "Keep sowing until every yard is bare.",
};

export const RULE_BLURBS: Record<"classic" | "first-empty" | "until-empty", string> = {
  classic:
    "Standard Kalah. Extra turn if you land in your coop. Capture by landing in an empty yard on your side when the opposite yard has hens — both flocks go to your coop. When a side is empty, leftover chickens go to the player who still has them.",
  "first-empty":
    "Same sowing and captures, but the first player to clear their yards claims every leftover chicken on the board.",
  "until-empty":
    "Keep taking turns until every yard is empty. Captures and extra turns still count. If your yards are bare, pick one yard from across the fence — both keepers share whatever flock is left.",
};

export const HOW_TO_STEPS = [
  "Each player has six fenced yards and a chicken coop. Every yard starts with four Orpingtons.",
  "On your turn pick one of your numbered yards. Sow those hens one by one counterclockwise, skipping the other coop. Numbers 1–6 follow the glowing yards — across in landscape, down your column in portrait.",
  "If the last hen lands in your coop, take another turn — unless that sow already ended the game.",
  "If she lands in an empty yard on your side and the opposite yard has hens, both flocks go to your coop. That's a capture.",
  "Classic: when a side empties, leftover hens go to the player who still has them. First empty: the player who clears first claims the leftovers. Until empty: keep sowing — if your yards are bare, pick from the other side until every yard is empty.",
] as const;

export function displayTurn(name: string, yours: boolean): string {
  if (yours && (name === "You" || name === "")) return "Your turn — pick a yard";
  if (yours) return `${name} — pick a yard`;
  return `${name}'s turn`;
}

export function displayTakes(name: string, what: string): string {
  return name === "You" ? `You take ${what}` : `${name} takes ${what}`;
}

export function displayCallsHome(name: string, amount: number): string {
  return name === "You" ? `You call ${amount} home` : `${name} calls ${amount} home`;
}

export function displaySteals(name: string, amount: number): string {
  return name === "You" ? `You steal ${amount}` : `${name} steals ${amount}`;
}

export function displayLeftovers(name: string, claim: boolean): string {
  if (name === "You") return claim ? "You claim the leftover flock" : "You take the leftover flock";
  return claim ? `${name} claims the leftover flock` : `${name} takes the leftover flock`;
}

export function yardBrief(args: {
  you: string;
  rival: string;
  mode: "solo" | "hotseat" | "online";
  difficulty: number;
  rules: "classic" | "first-empty" | "until-empty";
  bestOf: number;
}): string {
  const you = args.you.trim() || "You";
  const rival =
    args.mode === "online"
      ? "another keeper"
      : args.rival.trim() || (args.mode === "solo" ? "a surprise hen" : "Friend");
  const bits = [`${you} vs ${rival}`];
  if (args.mode === "solo") bits.push(difficultyLabel(args.difficulty));
  bits.push(RULE_LABELS[args.rules]);
  bits.push(args.bestOf === 1 ? "one game" : `best of ${args.bestOf}`);
  return bits.join(" · ");
}
