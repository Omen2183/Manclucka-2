import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { FarmScene } from "@/components/game/FarmScene";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <FarmScene>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-end px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(6rem,env(safe-area-inset-top))] text-center sm:justify-center">
        <div className="farm-card w-full rounded-2xl p-5">
          <span className="text-primary" aria-hidden="true">
            <TriangleAlert className="mx-auto size-10" strokeWidth={2} />
          </span>
          <h1 className="mt-2 font-display text-2xl">The hens scattered</h1>
          <p className="mt-2 max-w-md text-sm break-words text-muted">{errorMessage(error)}</p>
        </div>
      </main>
    </FarmScene>
  );
}
