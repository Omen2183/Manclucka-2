/**
 * React binding for P2PRoom. Identity and room id are captured once on mount
 * (useState initializers) so re-renders never tear down the mesh.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { P2PRoom, type PeerInfo } from "./p2p";

export interface UseP2PRoomOptions {
  room?: string;
  name?: string;
  selfId?: string;
}

export interface P2PRoomHandle {
  selfId: string;
  room: string;
  peers: PeerInfo[];
  joined: boolean;
  full: boolean;
  broadcast: (data: unknown) => boolean;
  send: (data: unknown, peerId?: string) => boolean;
  onMessage: (
    fn: (from: string, data: unknown, channel: "state" | "reliable") => void,
  ) => () => void;
}

function defaultRoom(): string {
  if (typeof window === "undefined") return "room-ssr";
  return `room-${window.location.hostname.split(".")[0]}`.slice(0, 64);
}

const PEER_RE = /^p-[a-z0-9]{4,16}$/;

export function useP2PRoom(options: UseP2PRoomOptions = {}): P2PRoomHandle {
  const [selfId] = useState(() => {
    if (options.selfId && PEER_RE.test(options.selfId)) return options.selfId;
    const bytes = new Uint8Array(5);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < 5; i++) bytes[i] = Math.floor(Math.random() * 256);
    return `p-${[...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").replace(/[^a-z0-9]/g, "a").slice(0, 8)}`;
  });
  const [room] = useState(() => options.room ?? defaultRoom());
  const [name] = useState(() => options.name ?? selfId);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [joined, setJoined] = useState(false);
  const [full, setFull] = useState(false);
  const [gen, setGen] = useState(0);
  const roomRef = useRef<P2PRoom | null>(null);
  const listeners = useRef(
    new Set<(from: string, data: unknown, channel: "state" | "reliable") => void>(),
  );

  useEffect(() => {
    const p2p = new P2PRoom({
      room,
      selfId,
      name,
      onPeersChanged: setPeers,
      onMessage: (from, data, channel) => {
        for (const fn of listeners.current) fn(from, data, channel);
      },
      onConnected: () => setJoined(true),
      onFull: () => setFull(true),
    });
    roomRef.current = p2p;
    void p2p.join();
    const onHide = (ev: PageTransitionEvent) => {
      if (ev.persisted) return;
      p2p.close();
      roomRef.current = null;
    };
    const onShow = () => {
      if (roomRef.current == null) setGen((n) => n + 1);
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
      roomRef.current = null;
      p2p.close();
    };
  }, [room, selfId, name, gen]);

  const broadcast = useCallback((data: unknown) => roomRef.current?.broadcast(data) ?? false, []);
  const send = useCallback(
    (data: unknown, peerId?: string) => roomRef.current?.send(data, peerId) ?? false,
    [],
  );
  const onMessage = useCallback(
    (fn: (from: string, data: unknown, channel: "state" | "reliable") => void) => {
      listeners.current.add(fn);
      return () => {
        listeners.current.delete(fn);
      };
    },
    [],
  );

  return useMemo(
    () => ({ selfId, room, peers, joined, full, broadcast, send, onMessage }),
    [selfId, room, peers, joined, full, broadcast, send, onMessage],
  );
}
