import { ArrowLeft, Copy, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { FarmScene } from "@/components/game/FarmScene";
import { MixerButton } from "@/components/game/MixerButton";
import { Button } from "@/components/ui/button";
import { RULE_LABELS } from "@/game/names";
import type { MatchSettings } from "@/game/types";
import { crowAbout } from "@/lib/utils";

export function LobbyScreen({
  code,
  host,
  settings,
  selfName,
  peerName,
  connected,
  failed,
  emptyTimeout,
  full = false,
  canStart,
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
  full?: boolean;
  canStart?: boolean;
  onStart: () => void;
  onBack: () => void;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const stuck = !host && !connected && (failed || emptyTimeout || full);

  function inviteText() {
    const origin = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    const url = origin ? `${origin}?flock=${encodeURIComponent(code)}` : code;
    return { url, text: `Join my Manclucka 2 flock: ${code}` };
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${inviteText().text}\n${inviteText().url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      const result = await crowAbout(code);
      setCopied(result !== "failed");
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  async function share() {
    const { url, text } = inviteText();
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Manclucka 2", text, url });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      await copy();
    }
  }

  const startReady = canStart ?? connected;

  return (
    <FarmScene>
      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Button variant="secondary" className="w-fit" onClick={onBack}>
            <ArrowLeft />
            Leave
          </Button>
          <MixerButton className="farm-panel rounded-md" />
        </div>
        <div className="farm-card rounded-2xl px-4 py-5 sm:px-5">
          <h1 className="font-display text-3xl">{host ? "Your flock code" : stuck ? "Could not join" : "Joining flock"}</h1>
          <p className="mt-1 text-sm text-muted">
            {RULE_LABELS[settings.rules]} · best of {settings.bestOf}
          </p>

          <div className="farm-panel mt-6 rounded-2xl px-4 py-6 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">code</p>
            <p className="mt-2 font-display text-4xl tracking-[0.18em]">{code}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" onClick={() => void copy()}>
                <Copy />
                <span aria-live="polite">{copied ? "Copied" : "Copy code"}</span>
              </Button>
              <Button variant="secondary" onClick={() => void share()}>
                <Share2 />
                Share
              </Button>
            </div>
          </div>

          <div className="farm-panel mt-4 space-y-2 rounded-xl p-4 text-sm">
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
            <p className={stuck ? "font-medium text-danger" : "text-muted"} role="status">
              {stuck
                ? full
                  ? "That yard already has two keepers."
                  : emptyTimeout
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
            <Button size="lg" className="mt-6 w-full" disabled={!startReady} onClick={onStart}>
              {startReady ? "Start match" : (
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
      </div>
    </FarmScene>
  );
}
