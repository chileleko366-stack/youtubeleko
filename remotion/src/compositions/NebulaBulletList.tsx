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
import { ParticleField } from "../lib/particles";

// Deterministic star field
const BG_STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: random(`nb-x-${i}`) * 100,
  y: random(`nb-y-${i}`) * 100,
  size: random(`nb-s-${i}`) * 1.8 + 0.3,
  opacity: random(`nb-o-${i}`) * 0.35 + 0.08,
  tw: random(`nb-t-${i}`) * 55,
  speed: 35 + random(`nb-sp-${i}`) * 30,
}));

// Arrow SVG path circumference estimate (for strokeDashoffset animation)
const ARROW_PATH = "M 0 10 L 14 0 L 14 7 L 28 7 L 28 13 L 14 13 L 14 20 Z";

export const NebulaBulletList: React.FC<CompositionProps> = ({
  text,
  bullets,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = bullets && bullets.length > 0 ? bullets : [text];

  // Hue rotation for animated nebula background
  const hueShift = (frame * 0.4) % 360;

  // Title
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [-28, 0]);

  // Title underline
  const lineSpring = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const lineWidth = interpolate(lineSpring, [0, 1], [0, 100]);

  // Vertical glowing connecting line grows from top as bullets appear
  const lastBulletDelay = 14 + (items.length - 1) * 10;
  const vertLineHeight = interpolate(
    frame,
    [14, lastBulletDelay + 12],
    [0, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000010",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Animated nebula gradient with hue-rotate */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 70% 90% at 15% 50%, rgba(60,0,120,0.4) 0%, transparent 65%),
            radial-gradient(ellipse 60% 70% at 85% 50%, rgba(0,20,100,0.35) 0%, transparent 65%),
            radial-gradient(ellipse 80% 50% at 50% 80%, rgba(20,0,60,0.3) 0%, transparent 70%)
          `,
          filter: `hue-rotate(${hueShift}deg)`,
        }}
      />

      {/* Static nebula layer (no hue rotation so it stays readable) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 90% at 50% 50%, rgba(0,0,15,0.5) 0%, transparent 100%)",
        }}
      />

      {/* Stars */}
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

      {/* ParticleField — 60 particles, purple/blue tones */}
      <ParticleField count={60} speedMultiplier={0.2} sizeRange={[0.3, 1.5]} />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 30%, rgba(0,0,8,0.8) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Left glowing accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          background: `linear-gradient(180deg, transparent, ${brandColor} 30%, ${brandColor} 70%, transparent)`,
          boxShadow: `0 0 20px ${brandColor}`,
          opacity: titleOpacity,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 1300,
          padding: "0 140px",
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontFamily: fontPrimary,
            fontSize: 64,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "4px",
            margin: "0 0 12px",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textShadow: `0 0 30px rgba(255,68,68,0.25)`,
          }}
        >
          {text}
        </h1>

        {/* Underline */}
        <div
          style={{
            height: 3,
            width: `${lineWidth}%`,
            background: `linear-gradient(90deg, ${brandColor}, rgba(120,40,255,0.5))`,
            marginBottom: 44,
            borderRadius: 2,
            boxShadow: `0 0 12px ${brandColor}`,
          }}
        />

        {/* Bullet items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
          {/* Vertical glowing connecting line on the left */}
          <div
            style={{
              position: "absolute",
              left: 14,
              top: 20,
              width: 2,
              height: `${vertLineHeight}%`,
              background: `linear-gradient(180deg, ${brandColor}, rgba(120,40,255,0.5))`,
              boxShadow: `0 0 8px ${brandColor}`,
              borderRadius: 1,
              transition: "none",
            }}
          />

          {items.map((item, i) => {
            const delay = 14 + i * 10;
            const bSpring = spring({
              frame: Math.max(0, frame - delay),
              fps,
              config: { damping: 16, stiffness: 110 },
            });
            const bOpacity = interpolate(bSpring, [0, 1], [0, 1]);
            const bX = interpolate(bSpring, [0, 1], [-60, 0]);

            // SVG arrow draws itself via strokeDashoffset
            const arrowProg = interpolate(bSpring, [0, 1], [60, 0]);

            // Alternating zebra treatment
            const isEven = i % 2 === 0;

            // Per-bullet word reveal
            const bulletWords = item.split(" ");
            const wordAnims = bulletWords.map((_, wi) => {
              const wDelay = delay + 4 + wi * 2;
              const wProg = interpolate(frame, [wDelay, wDelay + 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return {
                opacity: wProg,
                blur: interpolate(wProg, [0, 1], [3, 0]),
              };
            });

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 24,
                  opacity: bOpacity,
                  transform: `translateX(${bX}px)`,
                  padding: "12px 16px",
                  background: isEven
                    ? "rgba(255,255,255,0.025)"
                    : "rgba(255,68,68,0.02)",
                  borderRadius: 6,
                  borderLeft: isEven
                    ? `2px solid rgba(255,68,68,0.15)`
                    : `2px solid rgba(120,80,255,0.15)`,
                }}
              >
                {/* SVG triangle/arrow that draws itself */}
                <svg
                  width={30}
                  height={20}
                  viewBox="0 0 30 20"
                  style={{ flexShrink: 0, marginTop: 6 }}
                >
                  <path
                    d={ARROW_PATH}
                    fill="none"
                    stroke={brandColor}
                    strokeWidth={2}
                    strokeDasharray={60}
                    strokeDashoffset={arrowProg}
                    strokeLinejoin="round"
                    style={{ filter: `drop-shadow(0 0 4px ${brandColor})` }}
                  />
                </svg>

                {/* Bullet number + text */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                  <span
                    style={{
                      fontFamily: fontPrimary,
                      fontSize: 24,
                      color: brandColor,
                      opacity: 0.7,
                      minWidth: 32,
                      letterSpacing: "2px",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontFamily: fontSecondary,
                      fontSize: 28,
                      fontWeight: 400,
                      color: "rgba(255,255,255,0.9)",
                      lineHeight: 1.45,
                      letterSpacing: "0.3px",
                    }}
                  >
                    {bulletWords.map((word, wi) => (
                      <span
                        key={wi}
                        style={{
                          display: "inline-block",
                          opacity: wordAnims[wi].opacity,
                          filter: `blur(${wordAnims[wi].blur}px)`,
                          marginRight: "0.3em",
                        }}
                      >
                        {word}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
