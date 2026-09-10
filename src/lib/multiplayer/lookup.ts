export type LookupOk = { ok: true; exists: boolean; peers: number };
export type LookupFail = { ok: false; reason: "timeout" | "network" | "invalid" | "full" };
export type LookupResult = LookupOk | LookupFail;

export const LOOKUP_TIMEOUT_MS = 4000;
export const LOBBY_EMPTY_MS = 20000;

const ROOM_RE = /^[A-Z0-9_-]{1,64}$/;

export function normalizeFlockCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function isFlockCode(code: string): boolean {
  return code.length === 6 && ROOM_RE.test(code);
}

export async function lookupFlock(
  code: string,
  timeoutMs = LOOKUP_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<LookupResult> {
  const room = normalizeFlockCode(code);
  if (!isFlockCode(room)) return { ok: false, reason: "invalid" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`/api/rtc?lookup=1&room=${encodeURIComponent(room)}`, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (res.status === 409) return { ok: false, reason: "full" };
    if (!res.ok) return { ok: false, reason: "network" };
    const body: unknown = await res.json();
    if (!body || typeof body !== "object") return { ok: false, reason: "network" };
    const rec = body as { exists?: unknown; peers?: unknown };
    if (typeof rec.exists !== "boolean") return { ok: false, reason: "network" };
    const peers = typeof rec.peers === "number" && Number.isFinite(rec.peers) ? rec.peers : 0;
    if (peers >= 2) return { ok: false, reason: "full" };
    return { ok: true, exists: rec.exists && peers > 0, peers };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return { ok: false, reason: "timeout" };
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

export function lookupErrorCopy(reason: LookupFail["reason"] | "missing"): string {
  switch (reason) {
    case "missing":
      return "No flock with that code.";
    case "full":
      return "That yard already has two keepers.";
    case "timeout":
      return "That check took too long. Retry, or cancel.";
    case "network":
      return "Could not reach the yard. Retry, or cancel.";
    case "invalid":
      return "Use a six-character flock code.";
  }
}
