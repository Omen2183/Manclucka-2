import { useEffect, useMemo, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { LobbyScreen } from "@/components/game/LobbyScreen";
import { MenuScreen } from "@/components/game/MenuScreen";
import { PlayScreen } from "@/components/game/PlayScreen";
import { RulesScreen } from "@/components/game/RulesScreen";
import { SetupScreen } from "@/components/game/SetupScreen";
import { Button } from "@/components/ui/button";
import { startYard, playRooster } from "@/game/audio";
import { preloadArt } from "@/game/breeds";
import { initialState, openerOf, otherPlayer, scoreOf } from "@/game/engine";
import { displayTakes, pickOpponentName } from "@/game/names";
import { parseNetMessage, type NetMessage, type SyncMsg } from "@/game/net";
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
import { crowAbout, loadName, makeRoomCode, migrateLeakedNames, otherKeep, saveName, trimName } from "@/lib/utils";

type Screen = "menu" | "setup" | "lobby" | "play" | "rules";

const DEFAULTS: MatchSettings = {
  mode: "solo",
  rules: "classic",
  bestOf: 3,
  difficulty: 3,
  playerName: "",
  friendName: "",
};

function parkedPlay(): MatchSnapshot | null {
  const snap = loadMatchSnapshot();
  return snap?.phase === "play" ? snap : null;
}

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
  const joinGen = useRef(0);
  const joiningRef = useRef(false);

  useEffect(() => {
    migrateLeakedNames();
    const stored = loadName();
    const patch = loadSettingsPatch();
    setSettings((s) => ({
      ...s,
      ...patch,
      playerName: stored || patch.playerName || s.playerName,
    }));
    setResumeOffer(parkedPlay());
    startYard();
    preloadArt();
    const flock = new URLSearchParams(window.location.search).get("flock");
    if (flock) {
      const code = normalizeFlockCode(flock);
      if (code.length === 6) {
        setJoinCode(code);
        setSettings((s) => ({ ...s, mode: "online" }));
        setScreen("setup");
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
    return () => {
      /* yard keeps running for the session; stop on page hide via audio.ts */
    };
  }, []);

  const inMatch = screen === "play" || screen === "lobby";
  const leaveRef = useRef(() => {});
  leaveRef.current = () => {
    if (screen === "play") leaveKeepToMenu();
    else leaveToSetup();
  };

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

  function leaveKeepToMenu() {
    setResumeSnap(null);
    setJoinCode("");
    setJoinError(null);
    setJoining(false);
    setRoom(null);
    dropMatchHistory();
    setSettings((s) => cleanOnlineDraft(s));
    setResumeOffer(parkedPlay());
    setScreen("menu");
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
    if (code.length < 6 || joiningRef.current) return;
    const gen = ++joinGen.current;
    joiningRef.current = true;
    setJoining(true);
    setJoinError(null);
    let result = await lookupFlock(code);
    if (result.ok && !result.exists) {
      await new Promise((r) => setTimeout(r, 400));
      if (gen === joinGen.current) result = await lookupFlock(code);
    }
    if (result.ok && !result.exists) {
      await new Promise((r) => setTimeout(r, 700));
      if (gen === joinGen.current) result = await lookupFlock(code);
    }
    if (gen !== joinGen.current) return;
    joiningRef.current = false;
    setJoining(false);
    if (!result.ok) {
      setJoinError(lookupErrorCopy(result.reason));
      return;
    }
    if (!result.exists) {
      setJoinError(lookupErrorCopy("missing"));
      return;
    }
    if (result.peers >= 2) {
      setJoinError(lookupErrorCopy("full"));
      return;
    }
    saveName(settings.playerName);
    setHost(false);
    setRoom(code);
    setScreen("lobby");
  }

  if (screen === "menu") {
    return (
      <MenuScreen
        onPlay={() => setScreen("setup")}
        onRules={() => setScreen("rules")}
        resume={resumeOffer}
        onResume={() => resumeOffer && applyResume(resumeOffer)}
        onScatter={() => {
          clearMatchSnapshot();
          setResumeOffer(null);
          setSettings((s) => cleanOnlineDraft(s));
        }}
      />
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
          joinGen.current += 1;
          joiningRef.current = false;
          setJoinCode("");
          setJoinError(null);
          setJoining(false);
          setResumeOffer(parkedPlay());
          setScreen("menu");
        }}
        onStart={() => {
          joinGen.current += 1;
          setJoining(false);
          saveName(settings.playerName);
          setResumeSnap(null);
          clearMatchSnapshot();
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
        onPark={leaveKeepToMenu}
        onRetryJoin={() => {
          setLobbyGen((n) => n + 1);
        }}
        peerId={resumeSnap?.peerId}
      />
    );
  }

  if (screen === "play") {
    return (
      <LocalMatch
        settings={settings}
        resume={resumeSnap && resumeSnap.settings.mode !== "online" ? resumeSnap : null}
        onBack={leaveToSetup}
        onPark={leaveKeepToMenu}
      />
    );
  }

  return <MenuScreen onPlay={() => setScreen("setup")} onRules={() => setScreen("rules")} />;
}

function LocalMatch({
  settings,
  resume,
  onBack,
  onPark,
}: {
  settings: MatchSettings;
  resume: MatchSnapshot | null;
  onBack: () => void;
  onPark: () => void;
}) {
  const names = useMemo<[string, string]>(() => {
    if (resume) return [resume.names[0], otherKeep(resume.names[1], "Friend")];
    if (settings.mode === "hotseat") {
      return [trimName(settings.playerName, "You"), otherKeep(settings.friendName, "Friend")];
    }
    const hen = trimName(settings.friendName, "");
    return [trimName(settings.playerName, "You"), hen || pickOpponentName(settings.playerName)];
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
      onPark={onPark}
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
  onPark,
  incomingMoves,
  onMoveCommitted,
  onRequestNext,
  remoteNext,
  onRemoteNextConsumed,
  remoteForfeit,
  remoteSync,
  onRemoteSyncConsumed,
  incomingReset = 0,
  resume,
  persistMeta,
  onPersist,
}: {
  settings: MatchSettings;
  names: [string, string];
  south: Player;
  humanPlayers: ReadonlySet<Player>;
  aiPlayer: Player | null;
  onBack: () => void;
  onPark?: () => void;
  incomingMoves?: { pit: number; seq: number }[];
  onMoveCommitted?: (pit: number, next: GameState) => void;
  onRequestNext?: (gameIndex: number) => void;
  remoteNext?: number;
  onRemoteNextConsumed?: () => void;
  remoteForfeit?: Player | null;
  remoteSync?: SyncMsg | null;
  onRemoteSyncConsumed?: () => void;
  incomingReset?: number;
  resume?: MatchSnapshot | null;
  persistMeta: { host: boolean; room: string | null; phase: "play" | "lobby"; peerId?: string; seq?: number };
  onPersist?: (snap: MatchSnapshot) => void;
}) {
  const [scores, setScores] = useState<[number, number]>(() => resume?.scores ?? [0, 0]);
  const [gameIndex, setGameIndex] = useState(() => resume?.gameIndex ?? 0);
  const [gate, setGate] = useState<SeriesGate>(() => resume?.gate ?? "play");
  const [lastWinner, setLastWinner] = useState<Winner | null>(() => resume?.lastWinner ?? null);
  const [lastCoops, setLastCoops] = useState<[number, number]>(() => resume?.lastCoops ?? [0, 0]);
  const [matchKey, setMatchKey] = useState(0);
  const [board, setBoard] = useState<GameState>(
    () => resume?.board ?? initialState(settings.rules, openerOf(resume?.gameIndex ?? 0)),
  );
  const [crowded, setCrowded] = useState(false);
  const need = seriesNeed(settings.bestOf);
  const appliedForfeit = useRef(false);
  const gateRef = useRef(gate);
  gateRef.current = gate;

  function persist(nextBoard: GameState, nextScores: [number, number], nextGate: SeriesGate, nextIndex: number) {
    const snap: MatchSnapshot = {
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
      peerId: persistMeta.peerId,
      seq: persistMeta.seq ?? 0,
    };
    onPersist?.(snap);
    if (nextGate === "over") {
      clearMatchSnapshot();
      return;
    }
    saveMatchSnapshot(snap);
  }

  useEffect(() => {
    persist(board, scores, gate, gameIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, scores, gate, gameIndex, names, settings, south, lastWinner, lastCoops, persistMeta.seq]);

  useEffect(() => {
    if (!remoteSync) return;
    appliedForfeit.current = false;
    setScores(remoteSync.scores);
    setGameIndex(remoteSync.gameIndex);
    setGate(remoteSync.gate);
    if (remoteSync.gate === "over") {
      const a = remoteSync.scores[0];
      const b = remoteSync.scores[1];
      setLastWinner(a === b ? "draw" : a > b ? 0 : 1);
    } else {
      setLastWinner(remoteSync.ended ? remoteSync.winner : null);
    }
    setBoard({
      pits: remoteSync.pits.slice(),
      turn: remoteSync.turn,
      ended: remoteSync.ended,
      winner: remoteSync.winner,
      rules: settings.rules,
    });
    setMatchKey((k) => k + 1);
    onRemoteSyncConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteSync]);

  useEffect(() => {
    if (remoteNext == null) return;
    if (remoteNext === 0) {
      if (gate !== "over") {
        onRemoteNextConsumed?.();
        return;
      }
      appliedForfeit.current = false;
      setScores([0, 0]);
      setGameIndex(0);
      setGate("play");
      setLastWinner(null);
      setLastCoops([0, 0]);
      setBoard(initialState(settings.rules, openerOf(0)));
      setMatchKey((k) => k + 1);
      onRemoteNextConsumed?.();
      return;
    }
    if (gate === "between" && remoteNext === gameIndex + 1) {
      setGameIndex(remoteNext);
      setGate("play");
      setLastWinner(null);
      setBoard(initialState(settings.rules, openerOf(remoteNext)));
      onRemoteNextConsumed?.();
      return;
    }
    onRemoteNextConsumed?.();
  }, [remoteNext, gameIndex, settings.rules, gate, onRemoteNextConsumed]);

  useEffect(() => {
    if (remoteForfeit == null || appliedForfeit.current) return;
    if (gateRef.current === "over") return;
    appliedForfeit.current = true;
    const winner = otherPlayer(remoteForfeit);
    setLastWinner(winner);
    setLastCoops([scoreOf(board, 0), scoreOf(board, 1)]);
    const next: [number, number] = [scores[0], scores[1]];
    next[winner] = need;
    if (aiPlayer != null) recordGame(winner === 0);
    setScores(next);
    setGate("over");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteForfeit]);

  function handleGameOver(winner: Winner, coops: [number, number]) {
    if (gateRef.current !== "play") return;
    setLastWinner(winner);
    setLastCoops(coops);
    const next = tallyGame(scores, winner, need);
    if (next.gate === "over" && aiPlayer != null) recordGame(next.seriesWinner === 0);
    setScores(next.scores);
    setGate(next.gate);
  }

  function nextGame() {
    if (gate !== "between") return;
    const next = gameIndex + 1;
    const fresh = initialState(settings.rules, openerOf(next));
    setGameIndex(next);
    setGate("play");
    setLastWinner(null);
    setBoard(fresh);
    onRequestNext?.(next);
  }

  function rematch() {
    appliedForfeit.current = false;
    const fresh = initialState(settings.rules, openerOf(0));
    setScores(emptySeries().scores);
    setGameIndex(0);
    setGate("play");
    setLastWinner(null);
    setLastCoops([0, 0]);
    setBoard(fresh);
    setMatchKey((k) => k + 1);
    onRequestNext?.(0);
  }

  async function crowSeries() {
    const title =
      gate === "over" && seriesWinner != null
        ? displayTakes(names[seriesWinner], "the series")
        : lastWinner === "draw"
          ? "Even flock"
          : lastWinner != null
            ? displayTakes(names[lastWinner], "the game")
            : "Manclucka 2";
    const text = `${title} ${scores[0]}–${scores[1]} · Manclucka 2`;
    const result = await crowAbout(text);
    if (result === "copied") setCrowded(true);
  }

  const seriesWinner: Player | null = scores[0] >= need ? 0 : scores[1] >= need ? 1 : null;
  const nextOpener = gate === "between" ? names[openerOf(gameIndex + 1)] : null;
  const seriesTitle =
    gate === "over" && seriesWinner != null
      ? settings.bestOf === 1
        ? displayTakes(names[seriesWinner], "the game")
        : displayTakes(names[seriesWinner], "the series")
      : lastWinner === "draw"
        ? "Even flock"
        : lastWinner != null
          ? displayTakes(names[lastWinner], "the game")
          : "";

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
        onPark={onPark}
        onGameOver={handleGameOver}
        onMoveCommitted={onMoveCommitted}
        incomingMoves={incomingMoves ?? []}
        tallyEnded={(resume?.gate ?? "play") === "play"}
        online={settings.mode === "online"}
        incomingBase={persistMeta.seq ?? resume?.seq ?? 0}
        incomingReset={incomingReset}
      />
      {gate !== "play" && lastWinner != null && (
        <div className="fixed inset-0 z-30 flex items-end justify-center overflow-y-auto bg-wood-dark/55 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center series-overlay">
          <div
            className="series-card farm-card w-full max-w-md rounded-xl p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="series-title"
            tabIndex={-1}
          >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
              {gate === "over" ? (settings.bestOf === 1 ? "game" : "series") : `game ${gameIndex + 1}`}
            </p>
            <p id="series-title" className="mt-1 font-display text-2xl">
              {seriesTitle}
            </p>
            <p className="mt-1 text-sm text-muted">
              Coops {lastCoops[0]} – {lastCoops[1]}
              {nextOpener ? ` · ${nextOpener} opens the next game` : null}
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
                <>
                  <Button size="lg" autoFocus onClick={nextGame}>
                    Next game
                  </Button>
                  {onPark ? (
                    <Button size="lg" variant="secondary" onClick={onPark}>
                      Park the yard
                    </Button>
                  ) : (
                    <Button size="lg" variant="secondary" onClick={onBack}>
                      Leave
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button size="lg" autoFocus onClick={rematch}>
                    Rematch
                  </Button>
                  <Button size="lg" variant="secondary" onClick={() => void crowSeries()}>
                    <Share2 />
                    {crowded ? "Copied" : "Crow about it"}
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
  onPark,
  onRetryJoin,
  peerId,
}: {
  room: string;
  host: boolean;
  settings: MatchSettings;
  resume: MatchSnapshot | null;
  onBack: () => void;
  onLeaveToMenu: () => void;
  onPark: () => void;
  onRetryJoin: () => void;
  peerId?: string;
}) {
  const p2p = useP2PRoom({ room, name: trimName(settings.playerName, "You"), selfId: peerId });
  const [peerName, setPeerName] = useState<string | null>(
    resume?.names[host ? 1 : 0] && resume.names[host ? 1 : 0] !== "You" ? resume.names[host ? 1 : 0] : null,
  );
  const [playing, setPlaying] = useState(() => resume?.phase === "play" && host);
  const [names, setNames] = useState<[string, string]>(
    () =>
      resume?.names ??
      (host
        ? [trimName(settings.playerName, "You"), "Friend"]
        : ["Friend", trimName(settings.playerName, "You")]),
  );
  const [incoming, setIncoming] = useState<{ pit: number; seq: number }[]>([]);
  const [remoteNext, setRemoteNext] = useState<number | undefined>(undefined);
  const [remoteForfeit, setRemoteForfeit] = useState<Player | null>(null);
  const [remoteSync, setRemoteSync] = useState<SyncMsg | null>(null);
  const [seq, setSeq] = useState(resume?.seq ?? 0);
  const [incomingReset, setIncomingReset] = useState(0);
  const [syncedSettings, setSyncedSettings] = useState(settings);
  const [emptyTimeout, setEmptyTimeout] = useState(false);
  const [claim, setClaim] = useState(false);
  const seqRef = useRef(resume?.seq ?? 0);
  seqRef.current = seq;
  const connectedRef = useRef(false);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const startingRef = useRef(false);
  const persistRef = useRef<MatchSnapshot | null>(resume);
  const namesRef = useRef(names);
  namesRef.current = names;
  const sendRef = useRef(p2p.send);
  sendRef.current = p2p.send;
  const unloading = useRef(false);

  const peer = p2p.peers[0];
  const connected = !!peer?.reliableOpen;
  const failed = peer?.connectionState === "failed" || p2p.full;
  const south: Player = host ? 0 : 1;

  useEffect(() => {
    const mark = () => {
      unloading.current = true;
    };
    window.addEventListener("pagehide", mark);
    return () => {
      window.removeEventListener("pagehide", mark);
      if (playingRef.current && !unloading.current && persistRef.current?.gate !== "over") {
        sendRef.current({ type: "forfeit", player: south } satisfies NetMessage);
      }
    };
  }, [south]);

  useEffect(() => {
    if (playing || host) return;
    const t = window.setTimeout(() => {
      if (!connected && p2p.peers.length === 0) setEmptyTimeout(true);
    }, LOBBY_EMPTY_MS);
    return () => window.clearTimeout(t);
  }, [playing, host, connected, p2p.peers.length]);

  useEffect(() => {
    if (!playing) return;
    if (connected) {
      setClaim(false);
      return;
    }
    const t = window.setTimeout(() => setClaim(true), 12000);
    return () => window.clearTimeout(t);
  }, [playing, connected]);

  useEffect(() => {
    if (playing || host) return;
    saveMatchSnapshot({
      v: 1,
      savedAt: Date.now(),
      phase: "lobby",
      settings,
      names: [otherKeep(peerName), trimName(settings.playerName, "You")],
      south: 1,
      scores: [0, 0],
      gameIndex: 0,
      gate: "play",
      lastWinner: null,
      lastCoops: [0, 0],
      board: initialState(settings.rules, openerOf(0)),
      host,
      room,
      peerId: p2p.selfId,
      seq: 0,
    });
  }, [playing, host, settings, names, room, p2p.selfId, peerName]);

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
        board: initialState(settings.rules, openerOf(0)),
        host: true,
        room,
        peerId: p2p.selfId,
        seq: 0,
      });
    }
  }, [host, playing, settings, names, room, p2p.selfId]);

  useEffect(() => {
    const raw = peer?.name;
    if (raw) setPeerName(otherKeep(raw));
  }, [peer?.name]);

  useEffect(() => {
    return p2p.onMessage((_from, data, channel) => {
      if (channel !== "reliable") return;
      const msg = parseNetMessage(data);
      if (!msg) return;
      if (msg.type === "hello") {
        setPeerName(otherKeep(msg.name));
      }
      if (msg.type === "settings" && !host && !playingRef.current) {
        setSyncedSettings((s) => {
          if (s.rules === msg.settings.rules && s.bestOf === msg.settings.bestOf) return s;
          return { ...s, ...msg.settings };
        });
      }
      if (msg.type === "start" && !host && !playingRef.current) {
        setNames(msg.names);
        setSyncedSettings((s) => ({ ...s, ...msg.settings }));
        setPlaying(true);
      }
      if (msg.type === "sync") {
        if (msg.names) setNames(msg.names);
        seqRef.current = 0;
        setSeq(0);
        setIncoming([]);
        setIncomingReset((n) => n + 1);
        setRemoteSync(msg);
        setPlaying(true);
      }
      if (msg.type === "move") {
        if (msg.seq > seqRef.current) {
          seqRef.current = msg.seq;
          setSeq(msg.seq);
        }
        setIncoming((q) => {
          if (q.some((m) => m.seq === msg.seq)) return q;
          const next = [...q, { pit: msg.pit, seq: msg.seq }];
          return next.length > 48 ? next.slice(-48) : next;
        });
      }
      if (msg.type === "next") {
        seqRef.current = 0;
        setSeq(0);
        setRemoteNext(msg.gameIndex);
        setIncoming([]);
        setIncomingReset((n) => n + 1);
      }
      if (msg.type === "forfeit") {
        setRemoteForfeit(msg.player);
      }
    });
  }, [p2p.onMessage, host, south]);

  function pushSync() {
    const snap = persistRef.current;
    if (!snap) return;
    const msg: SyncMsg = {
      type: "sync",
      seq: seqRef.current,
      gameIndex: snap.gameIndex,
      scores: snap.scores,
      gate: snap.gate,
      pits: snap.board.pits,
      turn: snap.board.turn,
      ended: snap.board.ended,
      winner: snap.board.winner,
      names: namesRef.current,
    };
    p2p.send(msg);
    seqRef.current = 0;
    setSeq(0);
    setIncoming([]);
    setIncomingReset((n) => n + 1);
  }

  useEffect(() => {
    if (!connected) {
      connectedRef.current = false;
      return;
    }
    const rising = !connectedRef.current;
    connectedRef.current = true;
    if (rising) playRooster();
    if (!rising && !host) return;
    p2p.send({
      type: "hello",
      name: trimName(settings.playerName, "You"),
      seq: seqRef.current,
    } satisfies NetMessage);
    if (host && playingRef.current && rising) {
      if (persistRef.current) pushSync();
      else {
        p2p.send({
          type: "start",
          names: namesRef.current,
          settings: { rules: settings.rules, bestOf: settings.bestOf },
        } satisfies NetMessage);
      }
    } else if (host && rising) {
      p2p.send({
        type: "settings",
        settings: { rules: settings.rules, bestOf: settings.bestOf },
      } satisfies NetMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, host, p2p, settings]);

  function startMatch() {
    if (startingRef.current || !connected) return;
    const pair: [string, string] = [
      trimName(settings.playerName, "You"),
      otherKeep(peerName ?? peer?.name, "Friend"),
    ];
    startingRef.current = true;
    setNames(pair);
    const sent = p2p.send({
      type: "start",
      names: pair,
      settings: { rules: settings.rules, bestOf: settings.bestOf },
    } satisfies NetMessage);
    if (sent) setPlaying(true);
    else startingRef.current = false;
  }

  async function retryJoin() {
    setEmptyTimeout(false);
    const result = await lookupFlock(room);
    if (!result.ok || !result.exists || result.peers >= 2) {
      onBack();
      return;
    }
    onRetryJoin();
  }

  function scatter() {
    if (playingRef.current && persistRef.current?.gate !== "over") {
      p2p.send({ type: "forfeit", player: south } satisfies NetMessage);
    }
    onLeaveToMenu();
  }

  if (!playing) {
    return (
      <LobbyScreen
        code={room}
        host={host}
        settings={syncedSettings}
        selfName={trimName(settings.playerName, "You")}
        peerName={peerName}
        connected={connected}
        failed={!!failed}
        emptyTimeout={emptyTimeout}
        full={p2p.full}
        onStart={startMatch}
        onBack={onBack}
        onRetry={host ? undefined : () => void retryJoin()}
        canStart={connected && !!trimName(peerName ?? peer?.name, "")}
      />
    );
  }

  const humans = new Set<Player>([south]);

  return (
    <div className="relative">
      {playing && !connected && (
        <p className="fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-40 mx-auto w-fit rounded-md bg-wood-dark px-3 py-1.5 text-sm text-primary-fg">
          Flock link dropped — wait or go back
        </p>
      )}
      {claim && !connected && (
        <div className="farm-card fixed inset-x-0 top-[max(3.5rem,calc(env(safe-area-inset-top)+2.75rem))] z-40 mx-auto flex w-fit max-w-[min(24rem,calc(100%-1.5rem))] flex-col gap-2 rounded-xl p-3">
          <p className="text-sm">The other keeper left the yard.</p>
          <Button
            size="sm"
            onClick={() => {
              setRemoteForfeit(south === 0 ? 1 : 0);
            }}
          >
            Take the series
          </Button>
        </div>
      )}
      <SeriesMatch
        settings={syncedSettings}
        names={names}
        south={south}
        humanPlayers={humans}
        aiPlayer={null}
        incomingMoves={incoming}
        remoteNext={remoteNext}
        onRemoteNextConsumed={() => setRemoteNext(undefined)}
        remoteForfeit={remoteForfeit}
        remoteSync={remoteSync}
        onRemoteSyncConsumed={() => setRemoteSync(null)}
        incomingReset={incomingReset}
        resume={resume?.phase === "play" ? resume : null}
        persistMeta={{ host, room, phase: "play", peerId: p2p.selfId, seq }}
        onPersist={(snap) => {
          persistRef.current = snap;
        }}
        onBack={scatter}
        onPark={onPark}
        onMoveCommitted={(pit) => {
          const nextSeq = seqRef.current + 1;
          seqRef.current = nextSeq;
          setSeq(nextSeq);
          p2p.send({ type: "move", pit, seq: nextSeq } satisfies NetMessage);
        }}
        onRequestNext={(gameIndex) => {
          seqRef.current = 0;
          setSeq(0);
          setIncoming([]);
          setIncomingReset((n) => n + 1);
          p2p.send({ type: "next", gameIndex } satisfies NetMessage);
        }}
      />
    </div>
  );
}

