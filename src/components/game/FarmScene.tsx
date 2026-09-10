import type { ReactNode } from "react";
import { HERO_SRC } from "@/game/breeds";
import { cn } from "@/lib/utils";

export function FarmScene({
  children,
  hero = true,
  className,
}: {
  children: ReactNode;
  hero?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("farm-scene", hero && "farm-scene-hero", className)}>
      {hero ? (
        <img src={HERO_SRC} alt="" className="farm-hero-bg" crossOrigin="anonymous" />
      ) : null}
      <div className="farm-scene-shade" aria-hidden="true" />
      <div className="farm-scene-ground" aria-hidden="true" />
      <div className="farm-fence" aria-hidden="true" />
      <div className="farm-inner">{children}</div>
    </div>
  );
}
