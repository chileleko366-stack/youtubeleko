import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";

interface ParticleFieldProps {
  count?: number;
  color?: string;
  opacity?: number;
  speed?: number;
  size?: [number, number];
}

export const ParticleField: React.FC<ParticleFieldProps> = ({
  count = 80,
  color = "#ffffff",
  opacity = 0.6,
  speed = 1,
  size = [1, 3],
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const seed = `particle-${i}`;
        const baseX = random(`${seed}-x`) * 100;
        const baseY = random(`${seed}-y`) * 100;
        const particleSize =
          size[0] + random(`${seed}-size`) * (size[1] - size[0]);
        const driftSpeed = (0.5 + random(`${seed}-speed`) * 0.5) * speed;
        const phaseOffset = random(`${seed}-phase`) * Math.PI * 2;

        // Drift upward cyclically (wrap at top)
        const driftY =
          ((baseY - (frame * driftSpeed * 0.12)) % 110);
        const actualY = driftY < -10 ? driftY + 110 : driftY;

        // Subtle alpha pulse
        const pulse = interpolate(
          Math.sin(frame * 0.05 + phaseOffset),
          [-1, 1],
          [0.3, 1]
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${baseX}%`,
              top: `${actualY}%`,
              width: particleSize,
              height: particleSize,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: opacity * pulse,
              willChange: "transform",
            }}
          />
        );
      })}
    </div>
  );
};
