import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary } from "@/components/game/ErrorBoundary";
import { MancluckaApp } from "@/components/game/App";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <ErrorBoundary>
      <MancluckaApp />
    </ErrorBoundary>
  );
}