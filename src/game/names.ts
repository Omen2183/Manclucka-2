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

export function pickOpponentName(exclude?: string): string {
  const pool = OPPONENT_NAMES.filter((n) => n.toLowerCase() !== exclude?.trim().toLowerCase());
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

export const RULE_LABELS: Record<"classic" | "first-empty" | "until-empty", string> = {
  classic: "Classic Kalah",
  "first-empty": "First empty",
  "until-empty": "Until empty",
};

export const RULE_BLURBS: Record<"classic" | "first-empty" | "until-empty", string> = {
  classic:
    "Standard Kalah. Extra turn if you land in your coop. Capture the opposite yard by landing in an empty yard on your side. When a side is empty, leftover chickens go to the player who still has them.",
  "first-empty":
    "Same sowing and captures, but the first player to clear their yards claims every remaining chicken on the board.",
  "until-empty":
    "Keep sowing until every yard is empty. Captures and extra turns still count. If your yards are bare, you still take your turn from the other side — both keepers share whatever flock is left.",
};
