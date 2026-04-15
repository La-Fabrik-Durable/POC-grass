import { Suspense, lazy } from "react";
import { Debug } from "../utils/Debug";

const Perf = lazy(() => import("r3f-perf").then((m) => ({ default: m.Perf })));

export function DebugPerf() {
  const debug = Debug.getInstance();

  if (!debug.active) return null;

  return (
    <Suspense fallback={null}>
      <Perf position="bottom-right" />
    </Suspense>
  );
}