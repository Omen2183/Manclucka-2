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
  2: "Looks one yard ahead.",
  3: "Plans a little — still leaves openings.",
  4: "Thinks a couple of turns out.",
  5: "The sharpest hen. Still beatable.",
};

export const RULE_LABELS: Record<"classic" | "first-empty" | "until-empty", string> = {
  classic: "Classic Kalah",
  "first-empty": "First empty",
  "until-empty": "Until empty",
};

export const RULE_BLURBS: Record<"classic" | "first-empty" | "until-empty", string> = {
  classic:
    "Standard Kalah. Extra turn if you land in your coop. Capture by landing in an empty yard on your side when the opposite yard has hens — both flocks go to your coop. When a side is empty, leftover chickens go to the player who still has them.",
  "first-empty":
    "Same sowing and captures, but the first player to clear their yards claims every remaining chicken on the board.",
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
