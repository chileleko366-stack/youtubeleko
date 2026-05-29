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

// Deterministic upward-drifting particles
const PARTICLES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: random(`af-x-${i}`) * 100,
  startY: 60 + random(`af-sy-${i}`) * 40,
  speed: 0.04 + random(`af-sp-${i}`) * 0.06,
  size: random(`af-sz-${i}`) * 3 + 1,
  opacity: random(`af-o-${i}`) * 0.5 + 0.15,
  drift: (random(`af-d-${i}`) - 0.5) * 0.03,
  twinkle: random(`af-t-${i}`) * 60,
  delay: random(`af-dl-${i}`) * 30,
}));

const BG_STARS = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  x: random(`afstar-x-${i}`) * 100,
  y: random(`afstar-y-${i}`) * 80,
  size: random(`afstar-s-${i}`) * 1.8 + 0.4,
  opacity: random(`afstar-o-${i}`) * 0.5 + 0.1,
  tw: random(`afstar-t-${i}`) * 60,
  speed: 35 + random(`afstar-sp-${i}`) * 30,
}));

// Glitch characters for "DID YOU KNOW?" reveal
const GLITCH_CHARS = "!@#$%^&*<>?/\\|~`[]{}";
const DID_YOU_KNOW = "DID YOU KNOW?";

export const AstroFact: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const isShorts = height > width; // 1080x1920

  // --- DID YOU KNOW? glitch reveal ---
  // 0-3: scrambled, frame 3: snaps to correct
  const glitchPhase = frame < 3;
  const headerOpacity = interpolate(frame, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerText = glitchPhase
    ? DID_YOU_KNOW.split("").map((char, i) =>
        char === " " ? " " : GLITCH_CHARS[Math.floor((frame * 7 + i * 13) % GLITCH_CHARS.length)]
      ).join("")
    : DID_YOU_KNOW;

  // Background pulse
  const bgPulse = 0.3 + 0.15 * Math.abs(Math.sin((frame * Math.PI) / 50));

  // Main text — character-by-character spring reveal
  const chars = text.split("");
  const charAnims = chars.map((_, ci) => {
    const charDelay = 8 + ci * Math.max(1.5, 40 / Math.max(1, chars.length));
    const cSpring = spring({
      frame: Math.max(0, frame - charDelay),
      fps,
      config: { damping: 14, stiffness: 100 },
    });
    return {
      scale: interpolate(cSpring, [0, 1], [0.5, 1]),
      opacity: interpolate(cSpring, [0, 1], [0, 1]),
      blur: interpolate(cSpring, [0, 1], [6, 0]),
    };
  });

  // Bottom bar slides up
  const barSpring = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const barY = interpolate(barSpring, [0, 1], [120, 0]);
  const barOpacity = interpolate(barSpring, [0, 1], [0, 1]);

  // Pulsing circular glow behind text
  const glowPulse = 0.4 + 0.35 * Math.abs(Math.sin((frame * Math.PI) / 35));

  // Top accent line
  const topLineSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const topLineWidth = interpolate(topLineSpring, [0, 1], [0, 100]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000008",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background gradient — from bottom (deep blue) to top (black/space) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isShorts
            ? "linear-gradient(180deg, #000008 0%, rgba(0,5,40,0.5) 50%, rgba(0,15,60,0.4) 100%)"
            : "linear-gradient(180deg, #000008 0%, rgba(0,8,50,0.5) 60%, rgba(10,0,60,0.3) 100%)",
        }}
      />

      {/* Nebula radial wash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse ${isShorts ? "120% 50%" : "80% 80%"} at 50% 45%, rgba(40,0,80,0.6) 0%, rgba(0,0,30,0.4) 50%, transparent 100%),
            radial-gradient(ellipse 60% 40% at 80% 20%, rgba(0,20,100,0.25) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 20% 80%, rgba(60,0,100,0.2) 0%, transparent 55%)
          `,
        }}
      />

      {/* Background stars */}
      {BG_STARS.map((s) => {
        const tw =
          0.3 + 0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / s.speed));
        return (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              opacity: s.opacity * tw,
              transform: "translate(-50%,-50%)",
            }}
          />
        );
      })}

      {/* Floating particles drift UPWARD */}
      {PARTICLES.map((p) => {
        const effectiveFrame = Math.max(0, frame - p.delay);
        const currentY = p.startY - effectiveFrame * p.speed;
        const currentX = p.x + effectiveFrame * p.drift;
        const fadeIn = Math.min(1, effectiveFrame / 10);
        const fadeOut = currentY < 5 ? Math.max(0, currentY / 5) : 1;
        const tw =
          0.4 + 0.6 * Math.abs(Math.sin(((frame + p.twinkle) * Math.PI) / 40));

        if (currentY < 0 || currentY > 100) return null;

        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${currentX}%`,
              top: `${currentY}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: brandColor,
              opacity: p.opacity * tw * fadeIn * fadeOut * 0.6,
              transform: "translate(-50%,-50%)",
              boxShadow:
                p.size > 2.5
                  ? `0 0 ${p.size * 3}px ${brandColor}`
                  : undefined,
            }}
          />
        );
      })}

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 90% at 50% 50%, transparent 35%, rgba(0,0,8,0.85) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 5,
          width: `${topLineWidth}%`,
          background: `linear-gradient(90deg, ${brandColor}, rgba(255,68,68,0.3))`,
          boxShadow: `0 0 16px ${brandColor}`,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          padding: isShorts ? "0 60px" : "0 160px",
          maxWidth: isShorts ? 900 : 1400,
          width: "100%",
        }}
      >
        {/* "DID YOU KNOW?" with glitch reveal — fades in first */}
        <div
          style={{
            fontFamily: fontSecondary,
            fontSize: isShorts ? 22 : 20,
            color: "rgba(255,68,68,0.85)",
            letterSpacing: "10px",
            textTransform: "uppercase",
            marginBottom: isShorts ? 48 : 36,
            opacity: headerOpacity,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {headerText}
        </div>

        {/* Pulsing circular glow backdrop */}
        <div
          style={{
            position: "absolute",
            inset: isShorts ? "-80px -40px" : "-60px -80px",
            background: `radial-gradient(ellipse at 50% 50%, rgba(255,68,68,${glowPulse * 0.14}) 0%, transparent 65%)`,
            borderRadius: "50%",
            pointerEvents: "none",
          }}
        />

        {/* Main fact text — character by character with per-char spring */}
        <h1
          style={{
            fontFamily: fontPrimary,
            fontSize: isShorts ? 88 : 96,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "3px",
            lineHeight: 1.1,
            margin: 0,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 0.05em",
          }}
        >
          {chars.map((char, ci) => (
            <span
              key={ci}
              style={{
                display: "inline-block",
                opacity: charAnims[ci].opacity,
                transform: `scale(${charAnims[ci].scale})`,
                filter: `blur(${charAnims[ci].blur}px)`,
                textShadow: `
                  0 0 40px rgba(255,68,68,${glowPulse * 0.6}),
                  0 0 80px rgba(255,68,68,${glowPulse * 0.3}),
                  0 2px 4px rgba(0,0,0,0.8)
                `,
                whiteSpace: char === " " ? "pre" : "normal",
              }}
            >
              {char}
            </span>
          ))}
        </h1>

        {/* Red accent line */}
        <div
          style={{
            width: 100,
            height: 4,
            background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
            margin: `${isShorts ? 40 : 32}px auto 0`,
            boxShadow: `0 0 20px ${brandColor}`,
            borderRadius: 2,
          }}
        />
      </div>

      {/* Bottom branding bar — slides up */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: isShorts ? 110 : 90,
          background: `linear-gradient(0deg, rgba(255,68,68,0.92) 0%, rgba(180,0,0,0.85) 60%, transparent 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: barOpacity,
          transform: `translateY(${barY}px)`,
          gap: 20,
        }}
      >
        {/* CH6 logo mark */}
        <div
          style={{
            width: isShorts ? 48 : 40,
            height: isShorts ? 48 : 40,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: fontPrimary,
              fontSize: isShorts ? 20 : 17,
              color: "#ffffff",
              letterSpacing: "1px",
            }}
          >
            CH6
          </span>
        </div>

        <div
          style={{
            fontFamily: fontPrimary,
            fontSize: isShorts ? 32 : 26,
            color: "#ffffff",
            letterSpacing: "6px",
            textTransform: "uppercase",
          }}
        >
          RED SPACE FACTS
        </div>

        <div
          style={{
            fontFamily: fontSecondary,
            fontSize: isShorts ? 16 : 14,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "3px",
            textTransform: "uppercase",
          }}
        >
          SUBSCRIBE ↑
        </div>
      </div>
    </AbsoluteFill>
  );
};
