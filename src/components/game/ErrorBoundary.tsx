import { Component, type ErrorInfo, type ReactNode } from "react";
import { FarmScene } from "@/components/game/FarmScene";
import { Button } from "@/components/ui/button";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Manclucka 2 crashed", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <FarmScene>
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-end px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(6rem,env(safe-area-inset-top))] sm:justify-center">
          <div className="farm-card rounded-2xl p-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">spooked flock</p>
            <h1 className="mt-1 font-display text-3xl">The hens scattered</h1>
            <p className="mt-2 text-sm text-muted">Something tripped in the yard. You can pick back up without losing the app.</p>
            <Button
              className="mt-6 w-full"
              size="lg"
              onClick={() => {
                try {
                  window.localStorage.removeItem("manclucka:match");
                } catch {
                  /* ignore */
                }
                window.location.reload();
              }}
            >
              Back to the yard
            </Button>
          </div>
        </div>
      </FarmScene>
    );
  }
}
