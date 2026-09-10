/**
 * WebRTC signaling relay. Uses the app database when DATABASE_URL is set
 * (Neon on deploy) so any serverless instance can finish a handshake; falls
 * back to an in-process memory store for local preview.
 */
import { z } from "zod";
import type { PeerRow, RtcPollResponse, SignalRow } from "./p2p";

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const signalSchema = z.object({
  op: z.literal("signal"),
  room: ID,
  from: ID,
  to: ID,
  kind: z.enum(["offer", "answer", "ice"]),
  payload: z.unknown().refine((v) => v !== undefined && JSON.stringify(v).length <= 32_768, {
    message: "payload too large",
  }),
});
const leaveSchema = z.object({ op: z.literal("leave"), room: ID, peer: ID });
const postSchema = z.discriminatedUnion("op", [signalSchema, leaveSchema]);

const PEER_TTL_MS = 30_000;
const SIGNAL_TTL_MS = 60_000;

type Sql = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
};

const globalMem = globalThis as typeof globalThis & {
  __rtcMem__?: {
    peers: Map<string, { room: string; peer: string; name: string; lastSeen: number }>;
    signals: Array<{
      id: number;
      room: string;
      to: string;
      from: string;
      kind: SignalRow["kind"];
      payload: unknown;
      createdAt: number;
    }>;
    nextId: number;
  };
  __rtcSql__?: Promise<Sql | null>;
};

function mem() {
  globalMem.__rtcMem__ ??= { peers: new Map(), signals: [], nextId: 1 };
  return globalMem.__rtcMem__;
}

function key(room: string, peer: string) {
  return `${room}::${peer}`;
}

function useSql(): boolean {
  return Boolean(typeof process !== "undefined" && process.env.DATABASE_URL?.trim());
}

async function getSqlOrNull(): Promise<Sql | null> {
  if (!useSql()) return null;
  globalMem.__rtcSql__ ??= (async () => {
    const { getSql } = await import("@/lib/db");
    return (await getSql()) as Sql;
  })().catch((err) => {
    globalMem.__rtcSql__ = undefined;
    console.error("[rtc] sql backend unavailable, using memory", err);
    return null;
  });
  return globalMem.__rtcSql__;
}

const globalSchema = globalThis as typeof globalThis & { __rtcSchemaPromise__?: Promise<void> };

async function ensureSchema(sql: Sql): Promise<void> {
  globalSchema.__rtcSchemaPromise__ ??= (async () => {
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_peers (
         room TEXT NOT NULL,
         peer_id TEXT NOT NULL,
         name TEXT NOT NULL DEFAULT '',
         last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (room, peer_id)
       )`,
    );
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_signals (
         id BIGSERIAL PRIMARY KEY,
         room TEXT NOT NULL,
         to_peer TEXT NOT NULL,
         from_peer TEXT NOT NULL,
         kind TEXT NOT NULL,
         payload JSONB NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await sql.query(
      `CREATE INDEX IF NOT EXISTS webrtc_signals_inbox
         ON webrtc_signals (room, to_peer, id)`,
    );
  })().catch((err) => {
    globalSchema.__rtcSchemaPromise__ = undefined;
    throw err;
  });
  return globalSchema.__rtcSchemaPromise__;
}

function pruneMem(now: number) {
  const store = mem();
  for (const [k, p] of store.peers) {
    if (now - p.lastSeen > PEER_TTL_MS) store.peers.delete(k);
  }
  store.signals = store.signals.filter((s) => now - s.createdAt <= SIGNAL_TTL_MS);
  if (store.peers.size > 200) {
    const oldest = [...store.peers.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    for (const [k] of oldest.slice(0, store.peers.size - 160)) store.peers.delete(k);
  }
  if (store.signals.length > 400) store.signals = store.signals.slice(-300);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function handleGetSql(sql: Sql, room: string, peer: string, name: string, since: number) {
  await ensureSchema(sql);
  if (since === 0 || Math.random() < 0.02) {
    await Promise.all([
      sql.query(`DELETE FROM webrtc_signals WHERE created_at < now() - make_interval(secs => $1)`, [60]),
      sql.query(`DELETE FROM webrtc_peers WHERE last_seen < now() - make_interval(secs => $1)`, [30]),
    ]);
  }
  const occupancy = await sql.query<{ n: string | number }>(
    `SELECT count(*)::int AS n FROM webrtc_peers
     WHERE room = $1 AND peer_id <> $2 AND last_seen > now() - make_interval(secs => $3)`,
    [room, peer, 30],
  );
  if (Number(occupancy[0]?.n ?? 0) >= 2) {
    const mine = await sql.query<{ n: string | number }>(
      `SELECT count(*)::int AS n FROM webrtc_peers WHERE room = $1 AND peer_id = $2 AND last_seen > now() - make_interval(secs => $3)`,
      [room, peer, 30],
    );
    if (Number(mine[0]?.n ?? 0) === 0) {
      return json({ error: "full", peers: [] as PeerRow[], signals: [] as SignalRow[] }, 409);
    }
  }
  await sql.query(
    `INSERT INTO webrtc_peers (room, peer_id, name, last_seen)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (room, peer_id)
     DO UPDATE SET last_seen = now(), name = EXCLUDED.name`,
    [room, peer, name],
  );
  const rows = await sql.query<{
    id: number;
    from_peer: string;
    kind: SignalRow["kind"];
    payload: unknown;
  }>(
    `SELECT id, from_peer, kind, payload FROM webrtc_signals
     WHERE room = $1 AND to_peer = $2 AND id > $3
     ORDER BY id LIMIT 200`,
    [room, peer, since],
  );
  const peers = await sql.query<{ peer_id: string; name: string }>(
    `SELECT peer_id, name FROM webrtc_peers
     WHERE room = $1 AND last_seen > now() - make_interval(secs => $2)
     ORDER BY peer_id LIMIT 32`,
    [room, 30],
  );
  const body: RtcPollResponse = {
    peers: peers.map((r) => ({ id: r.peer_id, name: r.name })),
    signals: rows.map((r) => ({
      id: r.id,
      from: r.from_peer,
      kind: r.kind,
      payload: r.payload,
    })),
  };
  return json(body);
}

function handleGetMem(room: string, peer: string, name: string, since: number) {
  const now = Date.now();
  pruneMem(now);
  const store = mem();
  const others = [...store.peers.values()].filter((p) => p.room === room && p.peer !== peer);
  if (others.length >= 2 && !store.peers.has(key(room, peer))) {
    return json({ error: "full", peers: [] as PeerRow[], signals: [] as SignalRow[] }, 409);
  }
  store.peers.set(key(room, peer), { room, peer, name, lastSeen: now });
  const peers: PeerRow[] = [...store.peers.values()]
    .filter((p) => p.room === room)
    .sort((a, b) => a.peer.localeCompare(b.peer))
    .slice(0, 32)
    .map((p) => ({ id: p.peer, name: p.name }));
  const signals: SignalRow[] = store.signals
    .filter((s) => s.room === room && s.to === peer && s.id > since)
    .sort((a, b) => a.id - b.id)
    .slice(0, 200)
    .map((s) => ({ id: s.id, from: s.from, kind: s.kind, payload: s.payload }));
  return json({ peers, signals } satisfies RtcPollResponse);
}

async function countRoomPeersSql(sql: Sql, room: string): Promise<number> {
  await ensureSchema(sql);
  const rows = await sql.query<{ n: string | number }>(
    `SELECT COUNT(*)::int AS n FROM webrtc_peers
     WHERE room = $1 AND last_seen > now() - make_interval(secs => $2)`,
    [room, 30],
  );
  return Number(rows[0]?.n ?? 0);
}

function countRoomPeersMem(room: string): number {
  const now = Date.now();
  pruneMem(now);
  let n = 0;
  for (const p of mem().peers.values()) {
    if (p.room === room) n += 1;
  }
  return n;
}

async function handleLookup(url: URL): Promise<Response> {
  const parsed = z.object({ room: ID }).safeParse({ room: url.searchParams.get("room") });
  if (!parsed.success) return json({ error: "invalid query", exists: false, peers: 0 }, 400);
  const sql = await getSqlOrNull();
  const peers = sql ? await countRoomPeersSql(sql, parsed.data.room) : countRoomPeersMem(parsed.data.room);
  return json({ exists: peers > 0, peers });
}

async function handleGet(url: URL): Promise<Response> {
  if (url.searchParams.get("lookup") === "1") return handleLookup(url);
  const parsed = z
    .object({
      room: ID,
      peer: ID,
      name: z.string().max(64).default(""),
      since: z.coerce.number().int().min(0).default(0),
    })
    .safeParse({
      room: url.searchParams.get("room"),
      peer: url.searchParams.get("peer"),
      name: url.searchParams.get("name") ?? "",
      since: url.searchParams.get("since") ?? 0,
    });
  if (!parsed.success) return json({ error: "invalid query" }, 400);
  const { room, peer, name, since } = parsed.data;
  const sql = await getSqlOrNull();
  if (sql) return handleGetSql(sql, room, peer, name, since);
  return handleGetMem(room, peer, name, since);
}

async function handlePost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid request" }, 400);
  const msg = parsed.data;
  const sql = await getSqlOrNull();
  if (sql) {
    await ensureSchema(sql);
    if (msg.op === "signal") {
      const live = await sql.query<{ n: string | number }>(
        `SELECT count(*)::int AS n FROM webrtc_peers
         WHERE room = $1 AND peer_id = $2 AND last_seen > now() - make_interval(secs => $3)`,
        [msg.room, msg.from, 30],
      );
      if (Number(live[0]?.n ?? 0) === 0) return json({ error: "unknown peer" }, 403);
      const dest = await sql.query<{ n: string | number }>(
        `SELECT count(*)::int AS n FROM webrtc_peers
         WHERE room = $1 AND peer_id = $2 AND last_seen > now() - make_interval(secs => $3)`,
        [msg.room, msg.to, 30],
      );
      if (Number(dest[0]?.n ?? 0) === 0) return json({ error: "unknown peer" }, 403);
      await sql.query(
        `INSERT INTO webrtc_signals (room, to_peer, from_peer, kind, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [msg.room, msg.to, msg.from, msg.kind, JSON.stringify(msg.payload)],
      );
    } else {
      await sql.query(`DELETE FROM webrtc_signals WHERE room = $1 AND (to_peer = $2 OR from_peer = $2)`, [
        msg.room,
        msg.peer,
      ]);
      await sql.query(`DELETE FROM webrtc_peers WHERE room = $1 AND peer_id = $2`, [
        msg.room,
        msg.peer,
      ]);
    }
    return json({ ok: true });
  }

  const store = mem();
  pruneMem(Date.now());
  if (msg.op === "signal") {
    if (!store.peers.has(key(msg.room, msg.from))) return json({ error: "unknown peer" }, 403);
    if (!store.peers.has(key(msg.room, msg.to))) return json({ error: "unknown peer" }, 403);
    store.signals.push({
      id: store.nextId++,
      room: msg.room,
      to: msg.to,
      from: msg.from,
      kind: msg.kind,
      payload: msg.payload,
      createdAt: Date.now(),
    });
  } else {
    store.peers.delete(key(msg.room, msg.peer));
    store.signals = store.signals.filter((s) => s.from !== msg.peer && s.to !== msg.peer);
  }
  return json({ ok: true });
}

export async function handleSignaling(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") return await handleGet(new URL(request.url));
    if (request.method === "POST") return await handlePost(request);
    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[rtc] signaling error:", error);
    return json({ error: "signaling failed" }, 500);
  }
}
