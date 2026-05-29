import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface GradientBgProps {
  colors: string[];
  angle?: number;
  animate?: boolean;
}

export const GradientBg: React.FC<GradientBgProps> = ({
  colors,
  angle = 135,
  animate = false,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const animatedAngle = animate
    ? interpolate(frame, [0, durationInFrames], [angle, angle + 30])
    : angle;

  const linearGradient = `linear-gradient(${animatedAngle}deg, ${colors.join(", ")})`;
  const radialGradient = `radial-gradient(ellipse at 50% 40%, ${colors[0]}44 0%, transparent 70%)`;

  return (
    <>
      {/* Base linear gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: linearGradient,
          pointerEvents: "none",
        }}
      />
      {/* Radial bloom overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: radialGradient,
          pointerEvents: "none",
        }}
      />
      {/* Vignette — dark edges, bright center */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0,0,0,0.72) 100%)",
          pointerEvents: "none",
        }}
      />
    </>
  );
};
