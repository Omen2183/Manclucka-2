export const BREEDS = [
  { id: "buff", name: "Buff Orpington", src: "/chickens/buff.png" },
  { id: "lavender", name: "Lavender Orpington", src: "/chickens/lavender.png" },
  { id: "chocolate", name: "Chocolate Orpington", src: "/chickens/chocolate.png" },
  { id: "black", name: "Black Orpington", src: "/chickens/black.png" },
  { id: "blue", name: "Blue Orpington", src: "/chickens/blue.png" },
  { id: "white", name: "White Orpington", src: "/chickens/white.png" },
] as const;

export type BreedId = (typeof BREEDS)[number]["id"];

export function breedFor(pit: number, index: number): (typeof BREEDS)[number] {
  const n = BREEDS.length;
  return BREEDS[Math.abs(pit * 17 + index * 5 + 3) % n]!;
}

export const COOP_SRC = "/chickens/coop.png";
export const HERO_SRC = "/art/hero.jpg?v=8";

export function preloadArt(): void {
  if (typeof window === "undefined") return;
  for (const src of [...BREEDS.map((b) => b.src), COOP_SRC, "/art/pit.jpg", "/art/wood.jpg"]) {
    const img = new Image();
    img.src = src;
  }
  const hero = new Image();
  hero.src = HERO_SRC;
}
