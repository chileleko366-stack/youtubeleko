import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface GlowTextProps {
  text: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  glowColor?: string;
  glowRadius?: number;
  style?: React.CSSProperties;
}

export const GlowText: React.FC<GlowTextProps> = ({
  text,
  color = "#ffffff",
  fontSize = 72,
  fontFamily = "Anton",
  glowColor,
  glowRadius = 20,
  style,
}) => {
  const frame = useCurrentFrame();
  const glow = glowColor ?? color;

  // Pulse ±10% of glowRadius
  const pulsedRadius =
    glowRadius *
    interpolate(Math.sin(frame * 0.07), [-1, 1], [0.9, 1.1]);

  const textShadow = [
    `0 0 ${pulsedRadius * 0.4}px ${glow}ff`,
    `0 0 ${pulsedRadius}px ${glow}cc`,
    `0 0 ${pulsedRadius * 2}px ${glow}66`,
    `0 0 ${pulsedRadius * 4}px ${glow}33`,
  ].join(", ");

  const baseStyle: React.CSSProperties = {
    fontFamily,
    fontSize,
    color,
    textShadow,
    position: "relative",
    display: "inline-block",
    ...style,
  };

  // Chromatic aberration: R/G/B layers offset slightly
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {/* Red channel */}
      <span
        style={{
          ...baseStyle,
          position: "absolute",
          top: 0,
          left: 0,
          color: "rgba(255,60,60,0.35)",
          textShadow: "none",
          transform: "translate(-2px, 0)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
        aria-hidden
      >
        {text}
      </span>
      {/* Blue channel */}
      <span
        style={{
          ...baseStyle,
          position: "absolute",
          top: 0,
          left: 0,
          color: "rgba(60,120,255,0.3)",
          textShadow: "none",
          transform: "translate(2px, 0)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
        aria-hidden
      >
        {text}
      </span>
      {/* Main text */}
      <span style={baseStyle}>{text}</span>
    </span>
  );
};
