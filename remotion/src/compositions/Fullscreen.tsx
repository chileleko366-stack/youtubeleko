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

export const Fullscreen: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 22, stiffness: 90 } });
  const exitFrame = durationInFrames - 15;
  const exit = interpolate(frame, [exitFrame, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = Math.min(enter, exit);
  const scale = interpolate(enter, [0, 1], [0.85, 1]);

  // Abstract circle behind text — slowly scales up
  const circleScale = interpolate(frame, [0, durationInFrames], [1, 1.18]);
  const circleOpacity = interpolate(enter, [0, 1], [0, 0.07]);

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      <GradientBg
        colors={[backgroundColor, `${brandColor}1a`, `${brandColor}0d`, backgroundColor]}
        angle={135}
        animate
      />

      <ParticleField count={60} color={brandColor} opacity={0.25} speed={0.7} size={[1, 3]} />

      {/* Abstract background circle */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 800,
          height: 800,
          borderRadius: "50%",
          transform: `translate(-50%, -50%) scale(${circleScale})`,
          background: `radial-gradient(ellipse at center, ${brandColor}22 0%, transparent 70%)`,
          opacity: circleOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Main text block */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 100px",
        }}
      >
        <div
          style={{
            opacity,
            transform: `scale(${scale})`,
            textAlign: "center",
            maxWidth: 1400,
          }}
        >
          <GlowText
            text={text}
            color="#ffffff"
            fontSize={80}
            fontFamily={fontPrimary}
            glowColor={brandColor}
            glowRadius={28}
            style={{
              fontWeight: 900,
              lineHeight: 1.1,
              textTransform: "uppercase",
              letterSpacing: "-2px",
            }}
          />
          <div
            style={{
              width: 120,
              height: 6,
              background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
              margin: "40px auto 0",
              borderRadius: 3,
              boxShadow: `0 0 20px ${brandColor}99`,
            }}
          />
        </div>
      </div>

      <LightLeak opacity={0.08} />
      <Scanlines enabled opacity={0.03} />
    </AbsoluteFill>
  );
};
