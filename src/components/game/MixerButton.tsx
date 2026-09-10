import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getMixer, setMixer, setMuted, subscribeMixer, unlockAudio } from "@/game/audio";
import { cn } from "@/lib/utils";

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">{Math.round(value * 100)}</span>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[Math.round(value * 100)]}
        onValueChange={([v]) => onChange((v ?? 0) / 100)}
        aria-label={label}
      />
    </div>
  );
}

export function MixerButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [mix, setMix] = useState(getMixer);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeMixer(setMix), []);

  useEffect(() => {
    if (!open) return;
    function onDoc(ev: PointerEvent) {
      if (!root.current?.contains(ev.target as Node)) setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cn("relative", className)}>
      <Button
        variant={open ? "secondary" : "ghost"}
        size="icon"
        aria-label={mix.muted ? "Sound, muted" : "Sound"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          unlockAudio();
          setOpen((v) => !v);
        }}
      >
        {mix.muted || mix.master <= 0.01 ? <VolumeX /> : <Volume2 />}
      </Button>
      {open ? (
        <div
          className="farm-card absolute right-0 z-40 mt-2 w-64 rounded-xl p-3"
          role="dialog"
          aria-label="Sound"
        >
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">sound</p>
          <div className="mt-3 space-y-4">
            <Row
              label="All"
              value={mix.master}
              onChange={(master) => {
                unlockAudio();
                setMixer({ master, muted: master <= 0.01 });
              }}
            />
            <Row
              label="Chickens"
              value={mix.chickens}
              onChange={(chickens) => {
                unlockAudio();
                setMixer({ chickens });
              }}
            />
            <Row
              label="Yard"
              value={mix.yard}
              onChange={(yard) => {
                unlockAudio();
                setMixer({ yard });
              }}
            />
          </div>
          <Button
            size="sm"
            variant={mix.muted ? "secondary" : "ghost"}
            className="mt-3 w-full"
            onClick={() => {
              unlockAudio();
              setMuted(!mix.muted);
            }}
          >
            {mix.muted ? "Unmute" : "Mute all"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}