import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  random,
} from "remotion";
import type { CompositionProps } from "../Root";
import { GlowText } from "../lib/glowText";
import { easeOutExpo } from "../lib/easing";

// Three layers of stars generated deterministically
const BG_STARS = Array.from({ length: 300 }, (_, i) => ({
  id: i,
  x: random(`bg-x-${i}`) * 100,
  y: random(`bg-y-${i}`) * 100,
  size: random(`bg-s-${i}`) * 1.0 + 0.3,
  opacity: random(`bg-o-${i}`) * 0.25 + 0.05,
  twinkleOffset: random(`bg-t-${i}`) * 80,
  twinkleSpeed: 50 + random(`bg-ts-${i}`) * 40,
}));

const MID_STARS = Array.from({ length: 150 }, (_, i) => ({
  id: i,
  x: random(`mid-x-${i}`) * 100,
  y: random(`mid-y-${i}`) * 100,
  size: random(`mid-s-${i}`) * 1.5 + 0.6,
  opacity: random(`mid-o-${i}`) * 0.5 + 0.15,
  twinkleOffset: random(`mid-t-${i}`) * 80,
  twinkleSpeed: 35 + random(`mid-ts-${i}`) * 35,
  driftX: (random(`mid-dx-${i}`) - 0.5) * 0.006,
  driftY: (random(`mid-dy-${i}`) - 0.5) * 0.004,
}));

const FG_STARS = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  x: random(`fg-x-${i}`) * 100,
  y: random(`fg-y-${i}`) * 100,
  size: random(`fg-s-${i}`) * 2.5 + 1.0,
  opacity: random(`fg-o-${i}`) * 0.7 + 0.3,
  twinkleOffset: random(`fg-t-${i}`) * 80,
  twinkleSpeed: 20 + random(`fg-ts-${i}`) * 25,
  driftX: (random(`fg-dx-${i}`) - 0.5) * 0.014,
  driftY: (random(`fg-dy-${i}`) - 0.5) * 0.01,
}));

export const StarField: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Shooting star appears at frame ~60 (every 120 frames cycle)
  const shootingCycle = frame % 120;
  const shootingActive = shootingCycle >= 60 && shootingCycle <= 80;
  const shootingProgress = shootingActive
    ? interpolate(shootingCycle, [60, 80], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const shootingOpacity = shootingActive
    ? interpolate(shootingCycle, [60, 64, 76, 80], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // Nebula blobs opacity oscillation
  const nebulaA = 0.4 + 0.2 * Math.sin((frame * Math.PI) / 80);
  const nebulaB = 0.35 + 0.2 * Math.cos((frame * Math.PI) / 100);
  const nebulaC = 0.3 + 0.15 * Math.sin((frame * Math.PI) / 120 + 1);

  // Text reveal: letter-spacing wide → normal
  const textSpring = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 16, stiffness: 80 },
  });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textLetterSpacing = interpolate(textSpring, [0, 1], [40, 4]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#00000d",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Nebula backdrop: 3 large radial blobs */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 65% 55% at 20% 35%, rgba(60,0,110,${nebulaA}) 0%, transparent 60%),
            radial-gradient(ellipse 55% 65% at 75% 65%, rgba(0,15,90,${nebulaB}) 0%, transparent 60%),
            radial-gradient(ellipse 50% 45% at 55% 20%, rgba(80,0,30,${nebulaC}) 0%, transparent 55%)
          `,
          pointerEvents: "none",
        }}
      />

      {/* Background stars — barely visible */}
      {BG_STARS.map((s) => {
        const twinkle =
          0.2 +
          0.8 *
            Math.abs(
              Math.sin(((frame + s.twinkleOffset) * Math.PI) / s.twinkleSpeed)
            );
        return (
          <div
            key={`bg-${s.id}`}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              opacity: s.opacity * twinkle,
              transform: "translate(-50%,-50%)",
            }}
          />
        );
      })}

      {/* Mid stars — slow drift */}
      {MID_STARS.map((s) => {
        const twinkle =
          0.35 +
          0.65 *
            Math.abs(
              Math.sin(((frame + s.twinkleOffset) * Math.PI) / s.twinkleSpeed)
            );
        const cx = s.x + s.driftX * frame;
        const cy = s.y + s.driftY * frame;
        return (
          <div
            key={`mid-${s.id}`}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              backgroundColor: "#e8eeff",
              opacity: s.opacity * twinkle,
              transform: "translate(-50%,-50%)",
            }}
          />
        );
      })}

      {/* Foreground stars — faster drift + twinkle */}
      {FG_STARS.map((s) => {
        const twinkle =
          0.5 +
          0.5 *
            Math.abs(
              Math.sin(((frame + s.twinkleOffset) * Math.PI) / s.twinkleSpeed)
            );
        const cx = s.x + s.driftX * frame;
        const cy = s.y + s.driftY * frame;
        const glow = s.size > 2.5;
        return (
          <div
            key={`fg-${s.id}`}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              opacity: s.opacity * twinkle,
              transform: "translate(-50%,-50%)",
              boxShadow: glow
                ? `0 0 ${s.size * 3}px rgba(255,255,255,0.6)`
                : undefined,
            }}
          />
        );
      })}

      {/* Shooting star */}
      {shootingActive && (
        <div
          style={{
            position: "absolute",
            top: "22%",
            left: `${interpolate(shootingProgress, [0, 1], [15, 75])}%`,
            width: 80,
            height: 2,
            background: "linear-gradient(90deg, rgba(255,255,255,0.9), transparent)",
            opacity: shootingOpacity,
            transform: `rotate(-22deg)`,
            boxShadow: "0 0 6px rgba(255,255,255,0.8)",
          }}
        />
      )}

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 32%, rgba(0,0,10,0.82) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Center text */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          padding: "60px 140px",
          opacity: textOpacity,
        }}
      >
        {/* Glow backdrop */}
        <div
          style={{
            position: "absolute",
            inset: -40,
            background:
              "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,0,25,0.75) 0%, transparent 100%)",
            borderRadius: 24,
          }}
        />

        <div style={{ position: "relative" }}>
          <GlowText
            text={text}
            fontFamily={fontPrimary}
            fontSize={88}
            fontWeight={900}
            color="#ffffff"
            glowColor="rgba(255,255,255,0.35)"
            glowRadius={40}
            textTransform="uppercase"
            letterSpacing={`${textLetterSpacing}px`}
          />
        </div>

        <div
          style={{
            position: "relative",
            width: 60,
            height: 3,
            backgroundColor: brandColor,
            margin: "20px auto 0",
            boxShadow: `0 0 12px ${brandColor}`,
            borderRadius: 2,
          }}
        />

        <div
          style={{
            position: "relative",
            fontFamily: fontSecondary,
            fontSize: 20,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "6px",
            textTransform: "uppercase",
            marginTop: 16,
          }}
        >
          CH6 — RED SPACE FACTS
        </div>
      </div>
    </AbsoluteFill>
  );
};
