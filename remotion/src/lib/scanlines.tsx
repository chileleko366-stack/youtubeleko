import React from "react";
import { useCurrentFrame } from "remotion";

interface ScanlinesProps {
  enabled?: boolean;
  opacity?: number;
}

export const Scanlines: React.FC<ScanlinesProps> = ({
  enabled = true,
  opacity = 0.08,
}) => {
  const frame = useCurrentFrame();
  if (!enabled) return null;

  // Drift downward at ~0.5px per frame, wrapping every 4px (line + gap)
  const drift = (frame * 0.5) % 4;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        transform: `translateY(${drift}px)`,
        backgroundImage:
          "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,1) 2px, rgba(0,0,0,1) 4px)",
        backgroundSize: "100% 4px",
        opacity,
      }}
    />
  );
};
