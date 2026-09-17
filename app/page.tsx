import Canvas from "@/components/Canvas";

// Rendered per request so the first visit after the applications cutoff
// already shows the closed buttons, with no deploy or rebuild needed.
export const dynamic = "force-dynamic";

export default function Page() {
  return <Canvas />;
}
