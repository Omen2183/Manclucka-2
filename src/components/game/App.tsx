import { useEffect, useMemo, useRef, useState } from "react";
import { LobbyScreen } from "@/components/game/LobbyScreen";
import { MenuScreen } from "@/components/game/MenuScreen";
import { PlayScreen } from "@/components/game/PlayScreen";
import { RulesScreen } from "@/components/game/RulesScreen";
import { SetupScreen } from "@/components/game/SetupScreen";
import { Button } from "@/components/ui/button";
import { initialState } from "@/game/engine";
import { pickOpponentName } from "@/game/names";
import { parseNetMessage, type NetMessage } from "@/game/net";
import { emptySeries, seriesNeed, tallyGame } from "@/game/series";
import type { GameState, MatchSettings, Player, Winner } from "@/game/types";
import { LOBBY_EMPTY_MS, lookupErrorCopy, lookupFlock, normalizeFlockCode } from "@/lib/multiplayer/lookup";
import { useP2PRoom } from "@/lib/multiplayer";
import {
  clearMatchSnapshot,
  loadMatchSnapshot,
  loadSettingsPatch,
  recordGame,
  saveMatchSnapshot,
  saveSettings,
  type MatchSnapshot,
  type SeriesGate,
} from "@/lib/persist";
import { loadName, makeRoomCode, saveName } from "@/lib/utils";

type Screen = "menu" | "setup" | "lobby" | "play" | "rules";

const DEFAULTS: MatchSettings = {
  mode: "solo",
  rules: "classic",
  bestOf: 3,
  difficulty: 3,
  playerName: "Keeper",
  friendName: "Friend",
};

function dropMatchHistory() {
  if (typeof window === "undefined") return;
  if (window.history.state?.manclucka === "match") {
    window.history.replaceState(null, "");
  }
}

export function MancluckaApp() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [settings, setSettings] = useState<MatchSettings>(DEFAULTS);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [room, setRoom] = useState<string | null>(null);
  const [host, setHost] = useState(true);
  const [resumeOffer, setResumeOffer] = useState<MatchSnapshot | null>(null);
  const [resumeSnap, setResumeSnap] = useState<MatchSnapshot | null>(null);
  const [lobbyGen, setLobbyGen] = useState(0);

  useEffect(() => {
    const stored = loadName();
    const patch = loadSettingsPatch();
    setSettings((s) => ({
      ...s,
      ...patch,
      playerName: stored && stored !== DEFAULTS.playerName ? stored : s.playerName,
    }));
    setResumeOffer(loadMatchSnapshot());
  }, []);

  const inMatch = screen === "play" || screen === "lobby";
  const leaveRef = useRef(() => {});
  leaveRef.current = () => leaveToSetup();

  useEffect(() => {
    if (!inMatch) return;
    window.history.pushState({ manclucka: "match" }, "");
    const onPop = () => leaveRef.current();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [inMatch]);

  function patchSettings(patch: Partial<MatchSettings>) {
    setSettings((s) => {
      const next = { ...s, ...patch };
      if (patch.playerName !== undefined) saveName(patch.playerName);
      saveSettings(next);
      return next;
    });
  }

  function cleanOnlineDraft(next: MatchSettings): MatchSettings {
    if (next.mode !== "online") return next;
    const reset = { ...next, mode: "solo" as const };
    saveSettings(reset);
    return reset;
  }

  function leaveToSetup() {
    clearMatchSnapshot();
    setResumeSnap(null);
    setResumeOffer(null);
    setJoinCode("");
    setJoinError(null);
    setJoining(false);
    setRoom(null);
    dropMatchHistory();
    setSettings((s) => cleanOnlineDraft(s));
    setScreen("setup");
  }

  function leaveToMenu() {
    clearMatchSnapshot();
    setResumeSnap(null);
    setResumeOffer(null);
    setJoinCode("");
    setJoinError(null);
    setJoining(false);
    setRoom(null);
    dropMatchHistory();
    setSettings((s) => cleanOnlineDraft(s));
    setScreen("menu");
  }

  function applyResume(snap: MatchSnapshot) {
    setResumeOffer(null);
    setResumeSnap(snap);
    setSettings(snap.settings);
    saveSettings(snap.settings);
    if (snap.settings.mode === "online" && snap.room) {
      setHost(snap.host);
      setRoom(snap.room);
      setScreen("lobby");
    } else {
      setRoom(null);
      setScreen("play");
    }
  }

  async function tryJoin() {
    const code = normalizeFlockCode(joinCode);
    if (code.length < 6 || joining) return;
    setJoining(true);
    setJoinError(null);
    const result = await lookupFlock(code);
    setJoining(false);
    if (!result.ok) {
      setJoinError(lookupErrorCopy(result.reason));
      return;
    }
    if (!result.exists) {
      setJoinError(lookupErrorCopy("missing"));
      return;
    }
    saveName(settings.playerName);
    setHost(false);
    setRoom(code);
    setScreen("lobby");
  }

  if (screen === "menu") {
    return (
      <>
        <MenuScreen onPlay={() => setScreen("setup")} onRules={() => setScreen("rules")} />
        {resumeOffer ? (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-wood-dark/55 p-4 sm:items-center">
            <div
              className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-lg"
              role="dialog"
              aria-modal="true"
              aria-labelledby="resume-title"
            >
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">match in progress</p>
              <p id="resume-title" className="mt-1 font-display text-2xl">
                Resume match?
              </p>
              <p className="mt-1 text-sm text-muted">
                A yard was still in play. Resume to pick it up, or leave to start clean.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button size="lg" onClick={() => applyResume(resumeOffer)}>
                  Resume match
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => {
                    clearMatchSnapshot();
                    setResumeOffer(null);
                  }}
                >
                  Leave match
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }
  if (screen === "rules") {
    return <RulesScreen onBack={() => setScreen("menu")} />;
  }
  if (screen === "setup") {
    return (
      <SetupScreen
        settings={settings}
        joinCode={joinCode}
        joinError={joinError}
        joining={joining}
        onChange={patchSettings}
        onJoinCode={(code) => {
          setJoinCode(code);
          if (joinError) setJoinError(null);
        }}
        onBack={() => {
          setJoinCode("");
          setJoinError(null);
          setJoining(false);
          setScreen("menu");
        }}
        onStart={() => {
          saveName(settings.playerName);
          setResumeSnap(null);
          if (settings.mode === "online") {
            setHost(true);
            setRoom(makeRoomCode());
            setScreen("lobby");
          } else {
            setRoom(null);
            setResumeSnap(null);
            setScreen("play");
          }
        }}
        onJoin={() => void tryJoin()}
      />
    );
  }

  if (screen === "lobby" && room) {
    return (
      <OnlineShell
        key={`${room}-${lobbyGen}`}
        room={room}
        host={host}
        settings={settings}
        resume={resumeSnap?.settings.mode === "online" ? resumeSnap : null}
        onBack={leaveToSetup}
        onLeaveToMenu={leaveToMenu}
        onRetryJoin={() => {
          setLobbyGen((n) => n + 1);
        }}
      />
    );
  }

  if (screen === "play") {
    return (
      <LocalMatch
        settings={settings}
        resume={resumeSnap && resumeSnap.settings.mode !== "online" ? resumeSnap : null}
        onBack={leaveToSetup}
      />
    );
  }

  return <MenuScreen onPlay={() => setScreen("setup")} onRules={() => setScreen("rules")} />;
}

function LocalMatch({
  settings,
  resume,
  onBack,
}: {
  settings: MatchSettings;
  resume: MatchSnapshot | null;
  onBack: () => void;
}) {
  const names = useMemo<[string, string]>(() => {
    if (resume) return resume.names;
    if (settings.mode === "hotseat") return [settings.playerName || "Keeper", settings.friendName || "Friend"];
    return [settings.playerName || "Keeper", pickOpponentName(settings.playerName)];
  }, [settings.mode, settings.playerName, settings.friendName, resume]);

  const humanPlayers = useMemo(() => {
    if (settings.mode === "hotseat") return new Set<Player>([0, 1]);
    return new Set<Player>([0]);
  }, [settings.mode]);

  return (
    <SeriesMatch
      settings={settings}
      names={names}
      south={resume?.south ?? 0}
      humanPlayers={humanPlayers}
      aiPlayer={settings.mode === "solo" ? 1 : null}
      onBack={onBack}
      resume={resume}
      persistMeta={{ host: true, room: null, phase: "play" }}
    />
  );
}

function SeriesMatch({
  settings,
  names,
  south,
  humanPlayers,
  aiPlayer,
  onBack,
  incomingMoves,
  onMoveCommitted,
  onRequestNext,
  remoteNext,
  resume,
  persistMeta,
}: {
  settings: MatchSettings;
  names: [string, string];
  south: Player;
  humanPlayers: ReadonlySet<Player>;
  aiPlayer: Player | null;
  onBack: () => void;
  incomingMoves?: { pit: number; seq: number }[];
  onMoveCommitted?: (pit: number, next: GameState) => void;
  onRequestNext?: (gameIndex: number) => void;
  remoteNext?: number;
  resume?: MatchSnapshot | null;
  persistMeta: { host: boolean; room: string | null; phase: "play" | "lobby" };
}) {
  const [scores, setScores] = useState<[number, number]>(() => resume?.scores ?? [0, 0]);
  const [gameIndex, setGameIndex] = useState(() => resume?.gameIndex ?? 0);
  const [gate, setGate] = useState<SeriesGate>(() => resume?.gate ?? "play");
  const [lastWinner, setLastWinner] = useState<Winner | null>(() => resume?.lastWinner ?? null);
  const [lastCoops, setLastCoops] = useState<[number, number]>(() => resume?.lastCoops ?? [0, 0]);
  const [matchKey, setMatchKey] = useState(0);
  const [board, setBoard] = useState<GameState>(() => resume?.board ?? initialState(settings.rules, 0));
  const need = seriesNeed(settings.bestOf);

  function persist(nextBoard: GameState, nextScores: [number, number], nextGate: SeriesGate, nextIndex: number) {
    if (nextGate === "over") {
      clearMatchSnapshot();
      return;
    }
    saveMatchSnapshot({
      v: 1,
      savedAt: Date.now(),
      phase: persistMeta.phase,
      settings,
      names,
      south,
      scores: nextScores,
      gameIndex: nextIndex,
      gate: nextGate,
      lastWinner,
      lastCoops,
      board: nextBoard,
      host: persistMeta.host,
      room: persistMeta.room,
    });
  }

  useEffect(() => {
    persist(board, scores, gate, gameIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, scores, gate, gameIndex, names, settings, south]);

  useEffect(() => {
    if (remoteNext == null) return;
    if (remoteNext > gameIndex) {
      setGameIndex(remoteNext);
      setGate("play");
      setLastWinner(null);
      setBoard(initialState(settings.rules, 0));
    }
  }, [remoteNext, gameIndex, settings.rules]);

  function handleGameOver(winner: Winner, coops: [number, number]) {
    setLastWinner(winner);
    setLastCoops(coops);
    setScores((prev) => {
      const next = tallyGame(prev, winner, need);
      if (next.gate === "over" && aiPlayer != null) recordGame(next.seriesWinner === 0);
      setGate(next.gate);
      return next.scores;
    });
  }

  function nextGame() {
    if (gate !== "between") return;
    const next = gameIndex + 1;
    const fresh = initialState(settings.rules, 0);
    setGameIndex(next);
    setGate("play");
    setLastWinner(null);
    setBoard(fresh);
    onRequestNext?.(next);
  }

  function rematch() {
    const fresh = initialState(settings.rules, 0);
    setScores(emptySeries().scores);
    setGameIndex(0);
    setGate("play");
    setLastWinner(null);
    setBoard(fresh);
    setMatchKey((k) => k + 1);
    onRequestNext?.(0);
  }

  const seriesWinner: Player | null = scores[0] >= need ? 0 : scores[1] >= need ? 1 : null;

  return (
    <div className="relative">
      <PlayScreen
        key={`${matchKey}-${gameIndex}`}
        settings={settings}
        names={names}
        south={south}
        humanPlayers={humanPlayers}
        aiPlayer={aiPlayer}
        scores={scores}
        gameIndex={gameIndex}
        seed={board}
        onBoardSettled={setBoard}
        onBack={onBack}
        onGameOver={handleGameOver}
        onMoveCommitted={onMoveCommitted}
        incomingMoves={incomingMoves ?? []}
      />
      {gate !== "play" && lastWinner != null && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-wood-dark/55 p-4 sm:items-center">
          <div
            className="series-card w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="series-title"
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
              {gate === "over" ? "series" : `game ${gameIndex + 1}`}
            </p>
            <p id="series-title" className="mt-1 font-display text-2xl">
              {gate === "over" && seriesWinner != null
                ? `${names[seriesWinner]} takes the series`
                : lastWinner === "draw"
                  ? "Even flock"
                  : `${names[lastWinner]} takes the game`}
            </p>
            <p className="mt-1 text-sm text-muted">
              Coops {lastCoops[0]} – {lastCoops[1]}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              {([0, 1] as const).map((p) => (
                <div key={p} className="text-center">
                  <p className="max-w-28 truncate text-xs text-muted">{names[p]}</p>
                  <p className="font-display text-xl tabular-nums">{scores[p]}</p>
                  <p className="series-pips" aria-hidden="true">
                    {Array.from({ length: need }, (_, i) => (
                      <span key={i} className={i < scores[p] ? "pip-on" : "pip-off"} />
                    ))}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {gate === "between" ? (
                <Button size="lg" onClick={nextGame}>
                  Next game
                </Button>
              ) : (
                <>
                  <Button size="lg" onClick={rematch}>
                    Rematch
                  </Button>
                  <Button size="lg" variant="secondary" onClick={onBack}>
                    Back to yard
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OnlineShell({
  room,
  host,
  settings,
  resume,
  onBack,
  onLeaveToMenu,
  onRetryJoin,
}: {
  room: string;
  host: boolean;
  settings: MatchSettings;
  resume: MatchSnapshot | null;
  onBack: () => void;
  onLeaveToMenu: () => void;
  onRetryJoin: () => void;
}) {
  const p2p = useP2PRoom({ room, name: settings.playerName || "Keeper" });
  const [peerName, setPeerName] = useState<string | null>(resume?.names[host ? 1 : 0] ?? null);
  const [playing, setPlaying] = useState(() => resume?.phase === "play");
  const [names, setNames] = useState<[string, string]>(
    () => resume?.names ?? [settings.playerName || "Keeper", "Keeper"],
  );
  const [incoming, setIncoming] = useState<{ pit: number; seq: number }[]>([]);
  const [remoteNext, setRemoteNext] = useState<number | undefined>(undefined);
  const [seq, setSeq] = useState(0);
  const [syncedSettings, setSyncedSettings] = useState(settings);
  const [emptyTimeout, setEmptyTimeout] = useState(false);

  const peer = p2p.peers[0];
  const connected = peer?.connectionState === "connected";
  const failed = peer?.connectionState === "failed";

  useEffect(() => {
    if (playing || host) return;
    const t = window.setTimeout(() => {
      if (!connected && p2p.peers.length === 0) setEmptyTimeout(true);
    }, LOBBY_EMPTY_MS);
    return () => window.clearTimeout(t);
  }, [playing, host, connected, p2p.peers.length]);

  useEffect(() => {
    if (playing || host) return;
    saveMatchSnapshot({
      v: 1,
      savedAt: Date.now(),
      phase: "lobby",
      settings,
      names,
      south: host ? 0 : 1,
      scores: [0, 0],
      gameIndex: 0,
      gate: "play",
      lastWinner: null,
      lastCoops: [0, 0],
      board: initialState(settings.rules, 0),
      host,
      room,
    });
  }, [playing, host, settings, names, room]);

  useEffect(() => {
    if (host && !playing) {
      saveMatchSnapshot({
        v: 1,
        savedAt: Date.now(),
        phase: "lobby",
        settings,
        names,
        south: 0,
        scores: [0, 0],
        gameIndex: 0,
        gate: "play",
        lastWinner: null,
        lastCoops: [0, 0],
        board: initialState(settings.rules, 0),
        host: true,
        room,
      });
    }
  }, [host, playing, settings, names, room]);

  useEffect(() => {
    if (peer?.name) setPeerName(peer.name);
  }, [peer?.name]);

  useEffect(() => {
    return p2p.onMessage((_from, data) => {
      const msg = parseNetMessage(data);
      if (!msg) return;
      if (msg.type === "hello") setPeerName(msg.name);
      if (msg.type === "settings" && !host) {
        setSyncedSettings((s) => ({ ...s, ...msg.settings }));
      }
      if (msg.type === "start") {
        setNames(msg.names);
        setSyncedSettings((s) => ({ ...s, ...msg.settings }));
        setPlaying(true);
      }
      if (msg.type === "move") {
        setIncoming((q) => (q.some((m) => m.seq === msg.seq) ? q : [...q, { pit: msg.pit, seq: msg.seq }]));
      }
      if (msg.type === "next") {
        setRemoteNext(msg.gameIndex);
        setIncoming([]);
      }
    });
  }, [p2p, host]);

  useEffect(() => {
    if (!connected) return;
    p2p.send({ type: "hello", name: settings.playerName || "Keeper" } satisfies NetMessage);
    if (host) {
      p2p.send({
        type: "settings",
        settings: { rules: settings.rules, bestOf: settings.bestOf },
      } satisfies NetMessage);
    }
  }, [connected, host, p2p, settings]);

  function startMatch() {
    const pair: [string, string] = [settings.playerName || "Keeper", peerName || "Keeper"];
    setNames(pair);
    p2p.send({
      type: "start",
      names: pair,
      settings: { rules: settings.rules, bestOf: settings.bestOf },
    } satisfies NetMessage);
    setPlaying(true);
  }

  async function retryJoin() {
    setEmptyTimeout(false);
    const result = await lookupFlock(room);
    if (!result.ok || !result.exists) {
      onBack();
      return;
    }
    onRetryJoin();
  }

  if (!playing) {
    return (
      <LobbyScreen
        code={room}
        host={host}
        settings={syncedSettings}
        selfName={settings.playerName || "Keeper"}
        peerName={peerName}
        connected={connected}
        failed={!!failed}
        emptyTimeout={emptyTimeout}
        onStart={startMatch}
        onBack={onBack}
        onRetry={host ? undefined : () => void retryJoin()}
      />
    );
  }

  const south: Player = host ? 0 : 1;
  const humans = new Set<Player>([south]);

  return (
    <div className="relative">
      {playing && !connected && (
        <p className="fixed inset-x-0 top-2 z-40 mx-auto w-fit rounded-md bg-wood-dark px-3 py-1.5 text-sm text-primary-fg">
          Flock link dropped — wait or go back
        </p>
      )}
      <SeriesMatch
        settings={syncedSettings}
        names={names}
        south={south}
        humanPlayers={humans}
        aiPlayer={null}
        incomingMoves={incoming}
        remoteNext={remoteNext}
        resume={resume?.phase === "play" ? resume : null}
        persistMeta={{ host, room, phase: "play" }}
        onBack={onLeaveToMenu}
        onMoveCommitted={(pit) => {
          const nextSeq = seq + 1;
          setSeq(nextSeq);
          p2p.send({ type: "move", pit, seq: nextSeq } satisfies NetMessage);
        }}
        onRequestNext={(gameIndex) => {
          setIncoming([]);
          p2p.send({ type: "next", gameIndex } satisfies NetMessage);
        }}
      />
    </div>
  );
}