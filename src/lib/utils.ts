import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function makePeerId(): string {
  return `p-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadName(): string {
  if (typeof window === "undefined") return "Keeper";
  return window.localStorage.getItem("manclucka:name") || "Keeper";
}

export function saveName(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("manclucka:name", name.trim().slice(0, 24) || "Keeper");
}
