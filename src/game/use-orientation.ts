import { useCallback, useEffect, useState } from "react";

type ScreenOrientationLike = {
  lock?: (mode: string) => Promise<void>;
  unlock?: () => void;
};

function isLandscapeNow() {
  if (typeof window === "undefined") return false;
  return window.innerWidth > window.innerHeight * 1.02;
}

export function usePlayOrientation() {
  const [nativeLandscape, setNative] = useState(false);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const read = () => setNative(isLandscapeNow());
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    const mq = window.matchMedia("(orientation: landscape)");
    mq.addEventListener("change", read);
    try {
      (screen as Screen & { orientation?: ScreenOrientationLike }).orientation?.unlock?.();
    } catch {
      /* iOS and in-app browsers often deny this */
    }
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
      mq.removeEventListener("change", read);
    };
  }, []);

  const toggleFlip = useCallback(() => {
    const orient = (screen as Screen & { orientation?: ScreenOrientationLike }).orientation;
    const next = !flipped;
    if (next) {
      void orient?.lock?.("landscape").catch(() => undefined);
    } else {
      try {
        orient?.unlock?.();
      } catch {
        /* ignore */
      }
    }
    setFlipped(next);
  }, [flipped]);

  const landscape = nativeLandscape || flipped;
  const cssRotate = flipped && !nativeLandscape;

  return { nativeLandscape, landscape, cssRotate, flipped, toggleFlip };
}
