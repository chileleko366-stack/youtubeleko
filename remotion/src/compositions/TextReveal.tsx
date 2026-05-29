import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";
import { GradientBg } from "../lib/gradientBg";
import { GlowText } from "../lib/glowText";
import { LightLeak } from "../lib/lightLeak";
import { ParticleField } from "../lib/particles";
import { Scanlines } from "../lib/scanlines";
import { easeOutBack } from "../lib/easing";

export const TextReveal: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chars = text.split("");

  // Accent line spring
  const lineSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 160, mass: 0.6 },
  });
  const lineWidth = interpolate(easeOutBack(Math.min(lineSpring, 1)), [0, 1], [0, 100]);

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      <GradientBg
        colors={[backgroundColor, `${brandColor}18`, backgroundColor]}
        angle={145}
        animate
      />

      {/* Subtle particle field behind text */}
      <ParticleField count={20} color={brandColor} opacity={0.18} speed={0.6} size={[1, 2]} />

      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "8%",
          height: 4,
          width: `${lineWidth}%`,
          background: `linear-gradient(90deg, ${brandColor}, ${brandColor}88)`,
          borderRadius: 2,
          marginTop: -100,
          boxShadow: `0 0 16px ${brandColor}99`,
        }}
      />

      {/* Character-by-character text reveal */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "8%",
          right: "8%",
          transform: "translateY(-50%)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.05em",
        }}
      >
        <GlowText
          text=""
          color="#ffffff"
          fontSize={72}
          fontFamily={fontPrimary}
          glowColor={brandColor}
          glowRadius={24}
          style={{ display: "none" }}
        />
        <div
          style={{
            fontFamily: fontPrimary,
            fontSize: 72,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "-1px",
            lineHeight: 1.15,
            display: "flex",
            flexWrap: "wrap",
            gap: "0.025em",
          }}
        >
          {chars.map((char, i) => {
            const charDelay = i * 1.5;
            const charSpring = spring({
              frame: frame - charDelay,
              fps,
              config: { damping: 16, stiffness: 200, mass: 0.5 },
            });
            const charOpacity = interpolate(charSpring, [0, 1], [0, 1]);
            const charY = interpolate(charSpring, [0, 1], [30, 0]);
            const charScale = interpolate(charSpring, [0, 1], [0.6, 1]);
            const textShadow = [
              `0 0 12px ${brandColor}cc`,
              `0 0 32px ${brandColor}66`,
              `0 0 60px ${brandColor}33`,
            ].join(", ");

            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: charOpacity,
                  transform: `translateY(${charY}px) scale(${charScale})`,
                  textShadow: charOpacity > 0.5 ? textShadow : "none",
                  whiteSpace: char === " " ? "pre" : "normal",
                }}
              >
                {char === " " ? " " : char}
              </span>
            );
          })}
        </div>
      </div>

      {/* Bottom accent line — reversed, delayed */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "8%",
          height: 4,
          width: `${lineWidth * 0.6}%`,
          background: `linear-gradient(270deg, ${brandColor}, ${brandColor}44)`,
          borderRadius: 2,
          marginTop: 80,
          boxShadow: `0 0 12px ${brandColor}77`,
        }}
      />

      <LightLeak opacity={0.07} />
      <Scanlines enabled opacity={0.04} />
    </AbsoluteFill>
  );
};
