import React from "react";
import type { CompositionProps } from "./Root";
import { TextReveal } from "./compositions/TextReveal";

// Safe fallback renderer — delegates to the kinetic TextReveal so the router
// never produces a raw 48px static card even if treatment resolution fails.
export const Video: React.FC<CompositionProps & { treatment?: string }> = (
  props
) => {
  return <TextReveal {...props} />;
};
