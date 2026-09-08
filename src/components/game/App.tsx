import { useEffect, useMemo, useState } from "react";
import { LobbyScreen } from "@/components/game/LobbyScreen";
import { MenuScreen } from "@/components/game/MenuScreen";
import { PlayScreen } from "@/components/game/PlayScreen";
import { RulesScreen } from "@/components/game/RulesScreen";
import { SetupScreen } from "@/components/game/SetupScreen";
import { Button } from "@/components/ui/button";
import { pickOpponentName } from "@/game/names";
import { parseNetMessage, type NetMessage } from "@/game/net";
import { emptySeries, seriesNeed, tallyGame } from "@/game/series";
import type { GameState, MatchSettings, Player, Winner } from "@/game/types";
import { useP2PRoom } from "@/lib/multiplayer";
import { loadSettingsPatch, recordGame, saveSettings } from "@/lib/persist";
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

export function MancluckaApp() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [settings, setSettings] = useState<MatchSettings>(DEFAULTS);
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<string | null>(null);
  const [host, setHost] = useState(true);

  useEffect(() => {
    const stored = loadName();
    const patch = loadSettingsPatch();
    setSettings((s) => ({
      ...s,
      ...patch,
      playerName: stored && stored !== DEFAULTS.playerName ? stored : s.playerName,
    }));
  }, []);

  function patchSettings(patch: Partial<MatchSettings>) {
    setSettings((s) => {
      const next = { ...s, ...patch };
      if (patch.playerName !== undefined) saveName(patch.playerName);
      saveSettings(next);
      return next;
    });
  }

  if (screen === "menu") {
    return <MenuScreen onPlay={() => setScreen("setup")} onRules={() => setScreen("rules")} />;
  }
  if (screen === "rules") {
    return <RulesScreen onBack={() => setScreen("menu")} />;
  }
  if (screen === "setup") {
    return (
      <SetupScreen
        settings={settings}
        joinCode={joinCode}
        onChange={patchSettings}
        onJoinCode={setJoinCode}
        onBack={() => setScreen("menu")}
        onStart={() => {
          saveName(settings.playerName);
          if (settings.mode === "online") {
            setHost(true);
            setRoom(makeRoomCode());
            setScreen("lobby");
          } else {
            setRoom(null);
            setScreen("play");
          }
        }}
        onJoin={() => {
          if (joinCode.length < 6) return;
          saveName(settings.playerName);
          setHost(false);
          setRoom(joinCode);
          setScreen("lobby");
        }}
      />
    );
  }

  if (screen === "lobby" && room) {
    return (
      <OnlineShell
        key={room}
        room={room}
        host={host}
        settings={settings}
        onBack={() => {
          setRoom(null);
          setScreen("setup");
        }}
        onLeaveToMenu={() => {
          setRoom(null);
          setScreen("menu");
        }}
      />
    );
  }

  if (screen === "play") {
    return <LocalMatch settings={settings} onBack={() => setScreen("setup")} />;
  }

  return <MenuScreen onPlay={() => setScreen("setup")} onRules={() => setScreen("rules")} />;
}

function LocalMatch({ settings, onBack }: { settings: MatchSettings; onBack: () => void }) {
  const names = useMemo<[string, string]>(() => {
    if (settings.mode === "hotseat") return [settings.playerName || "Keeper", settings.friendName || "Friend"];
    return [settings.playerName || "Keeper", pickOpponentName(settings.playerName)];
  }, [settings.mode, settings.playerName, settings.friendName]);

  const humanPlayers = useMemo(() => {
    if (settings.mode === "hotseat") return new Set<Player>([0, 1]);
    return new Set<Player>([0]);
  }, [settings.mode]);

  return (
    <SeriesMatch
      settings={settings}
      names={names}
      south={0}
      humanPlayers={humanPlayers}
      aiPlayer={settings.mode === "solo" ? 1 : null}
      onBack={onBack}
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
}) {
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [gameIndex, setGameIndex] = useState(0);
  const [gate, setGate] = useState<"play" | "between" | "over">("play");
  const [lastWinner, setLastWinner] = useState<Winner | null>(null);
  const [lastCoops, setLastCoops] = useState<[number, number]>([0, 0]);
  const [matchKey, setMatchKey] = useState(0);
  const need = seriesNeed(settings.bestOf);

  useEffect(() => {
    if (remoteNext == null) return;
    if (remoteNext > gameIndex) {
      setGameIndex(remoteNext);
      setGate("play");
      setLastWinner(null);
    }
  }, [remoteNext, gameIndex]);

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
    setGameIndex(next);
    setGate("play");
    setLastWinner(null);
    onRequestNext?.(next);
  }

  function rematch() {
    setScores(emptySeries().scores);
    setGameIndex(0);
    setGate("play");
    setLastWinner(null);
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
        onBack={onBack}
        onGameOver={handleGameOver}
        onMoveCommitted={onMoveCommitted}
        incomingMoves={incomingMoves ?? []}
      />
      {gate !== "play" && lastWinner != null && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-wood-dark/55 p-4 sm:items-center">
          <div
            className="series-card w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-lg"
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
  onBack,
  onLeaveToMenu,
}: {
  room: string;
  host: boolean;
  settings: MatchSettings;
  onBack: () => void;
  onLeaveToMenu: () => void;
}) {
  const p2p = useP2PRoom({ room, name: settings.playerName || "Keeper" });
  const [peerName, setPeerName] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [names, setNames] = useState<[string, string]>([settings.playerName || "Keeper", "Keeper"]);
  const [incoming, setIncoming] = useState<{ pit: number; seq: number }[]>([]);
  const [remoteNext, setRemoteNext] = useState<number | undefined>(undefined);
  const [seq, setSeq] = useState(0);
  const [syncedSettings, setSyncedSettings] = useState(settings);

  const peer = p2p.peers[0];
  const connected = peer?.connectionState === "connected";
  const failed = peer?.connectionState === "failed";

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
        onStart={startMatch}
        onBack={onBack}
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
