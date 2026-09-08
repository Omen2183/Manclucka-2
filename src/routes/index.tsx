import { createFileRoute } from "@tanstack/react-router";
import { MancluckaApp } from "@/components/game/App";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <MancluckaApp />;
}
