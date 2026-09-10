import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint8Array(6);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < 6; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  let code = "";
  for (const b of buf) code += alphabet[b! % alphabet.length];
  return code;
}

export const NAME_MAX = 24;
const NAME_MIGRATION_KEY = "manclucka:name-v";
const NAME_MIGRATION = "2";
const LEAKED_DEFAULT_NAME = /^(josh|joshua|ashley)$/i;

function stripControls(name: string): string {
  return name.replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "");
}

export function isLeakedDefaultName(name: string | undefined | null): boolean {
  return LEAKED_DEFAULT_NAME.test(stripControls(String(name ?? "")).replace(/\s+/g, " ").trim());
}

export function trimName(name: string | undefined | null, fallback: string): string {
  const t = stripControls(String(name ?? ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX);
  if (!t || /^keeper$/i.test(t)) return fallback;
  return t;
}

/** Name for the other keeper — never "You". */
export function otherKeep(name: string | undefined | null, fallback = "Friend"): string {
  const t = trimName(name, fallback);
  if (/^you$/i.test(t)) return fallback;
  return t;
}

export function loadName(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("manclucka:name");
    if (!raw) return "";
    const t = stripControls(raw).replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
    if (!t || /^keeper$/i.test(t)) return "";
    return t;
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    const t = trimName(name, "");
    if (!t) window.localStorage.removeItem("manclucka:name");
    else window.localStorage.setItem("manclucka:name", t);
  } catch {
    /* private mode / quota */
  }
}

/** One-time: drop leftover sample names so a blank coop reads You. */
export function migrateLeakedNames(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(NAME_MIGRATION_KEY) === NAME_MIGRATION) return;
    const stored = window.localStorage.getItem("manclucka:name");
    if (stored && (isLeakedDefaultName(stored) || /^keeper$/i.test(stored.trim()))) {
      window.localStorage.removeItem("manclucka:name");
    }
    const raw = window.localStorage.getItem("manclucka:settings");
    if (raw) {
      const parsed = JSON.parse(raw) as { playerName?: unknown; friendName?: unknown };
      let dirty = false;
      if (typeof parsed.playerName === "string" && (isLeakedDefaultName(parsed.playerName) || /^keeper$/i.test(parsed.playerName.trim()))) {
        parsed.playerName = "";
        dirty = true;
      }
      if (typeof parsed.friendName === "string" && (isLeakedDefaultName(parsed.friendName) || /^keeper$/i.test(parsed.friendName.trim()))) {
        parsed.friendName = "";
        dirty = true;
      }
      if (dirty) window.localStorage.setItem("manclucka:settings", JSON.stringify(parsed));
    }
    window.localStorage.setItem(NAME_MIGRATION_KEY, NAME_MIGRATION);
  } catch {
    /* private mode / quota */
  }
}

export async function crowAbout(text: string, url?: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: "Manclucka 2", text, ...(url ? { url } : {}) });
      return "shared";
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    return "copied";
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = url ? `${text}\n${url}` : text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      return "copied";
    } catch {
      return "failed";
    }
  }
}
