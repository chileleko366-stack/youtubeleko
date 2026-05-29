import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface LightLeakProps {
  opacity?: number;
}

export const LightLeak: React.FC<LightLeakProps> = ({ opacity: maxOpacity = 0.06 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Fade in at 55–65% and fade out at 75–85%
  const progress = frame / durationInFrames;
  const leakOpacity = interpolate(
    progress,
    [0, 0.55, 0.65, 0.75, 0.85, 1],
    [0, 0, maxOpacity, maxOpacity, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Drift horizontally: left → right
  const xPos = interpolate(progress, [0, 1], [-10, 60]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: leakOpacity,
        background: `radial-gradient(ellipse 60% 80% at ${xPos}% 0%, #fff9e6 0%, rgba(255,230,150,0.6) 30%, transparent 70%)`,
      }}
    />
  );
};
