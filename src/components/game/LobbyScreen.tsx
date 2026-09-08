import { ArrowLeft, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RULE_LABELS } from "@/game/names";
import type { MatchSettings } from "@/game/types";

export function LobbyScreen({
  code,
  host,
  settings,
  selfName,
  peerName,
  connected,
  failed,
  emptyTimeout,
  onStart,
  onBack,
  onRetry,
}: {
  code: string;
  host: boolean;
  settings: MatchSettings;
  selfName: string;
  peerName: string | null;
  connected: boolean;
  failed: boolean;
  emptyTimeout: boolean;
  onStart: () => void;
  onBack: () => void;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const stuck = !host && !connected && (failed || emptyTimeout);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-10 pt-4">
      <Button variant="ghost" className="mb-4 w-fit" onClick={onBack}>
        <ArrowLeft />
        Leave
      </Button>
      <h1 className="font-display text-3xl">{host ? "Your flock code" : stuck ? "Could not join" : "Joining flock"}</h1>
      <p className="mt-1 text-sm text-muted">
        {RULE_LABELS[settings.rules]} · best of {settings.bestOf}
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-surface px-4 py-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">code</p>
        <p className="mt-2 font-display text-4xl tracking-[0.18em]">{code}</p>
        <Button variant="secondary" className="mt-4" onClick={() => void copy()}>
          <Copy />
          {copied ? "Copied" : "Copy code"}
        </Button>
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
        <p>
          You · <span className="font-medium">{selfName}</span>
        </p>
        <p>
          Other keeper ·{" "}
          {peerName ? (
            <span className="font-medium">{peerName}</span>
          ) : (
            <span className="text-muted">waiting</span>
          )}
        </p>
        <p className={stuck ? "font-medium text-[#8B2E1F]" : "text-muted"}>
          {stuck
            ? emptyTimeout
              ? "No flock with that code — or the host already left."
              : "Could not open a direct path. Try again, or play pass-and-play on one device."
            : failed
              ? "Could not open a direct path. Try again, or play pass-and-play on one device."
              : connected
                ? "Yard linked. Ready when you are."
                : "Linking the yards"}
        </p>
      </div>

      {host ? (
        <Button size="lg" className="mt-6" disabled={!connected} onClick={onStart}>
          {connected ? "Start match" : (
            <>
              <Loader2 className="animate-spin" />
              Waiting for a keeper
            </>
          )}
        </Button>
      ) : stuck ? (
        <div className="mt-6 flex flex-col gap-2">
          {onRetry ? (
            <Button size="lg" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
          <Button size="lg" variant="secondary" onClick={onBack}>
            Cancel
          </Button>
        </div>
      ) : (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          Waiting for the host to open the gate
        </p>
      )}
    </div>
  );
}