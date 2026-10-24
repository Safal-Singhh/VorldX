import { Suspense, lazy, useEffect, useState } from "react";

const LandingScene = lazy(() => import("./LandingScene").then((m) => ({ default: m.LandingScene })));

export function useAmbient3D() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqScreen = window.matchMedia("(min-width: 768px)");
    const update = () => setOn(!mqMotion.matches && mqScreen.matches);
    update();
    mqMotion.addEventListener("change", update);
    mqScreen.addEventListener("change", update);
    return () => { mqMotion.removeEventListener("change", update); mqScreen.removeEventListener("change", update); };
  }, []);
  return on;
}

export function AmbientBackground({ variant = "hero" }: { variant?: "hero" | "ambient" } = {}) {
  const on = useAmbient3D();
  if (!on) return null;
  return (
    <Suspense fallback={null}>
      <LandingScene variant={variant} />
    </Suspense>
  );
}
