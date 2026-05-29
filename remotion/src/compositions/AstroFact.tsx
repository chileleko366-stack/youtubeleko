import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

// Floating particles that drift upward
const PARTICLES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  startY: 60 + Math.random() * 40,   // start in lower portion
  speed: 0.04 + Math.random() * 0.06, // % per frame
  size: Math.random() * 3 + 1,
  opacity: Math.random() * 0.5 + 0.15,
  drift: (Math.random() - 0.5) * 0.03,
  twinkle: Math.random() * 60,
  delay: Math.random() * 30,
}));

const BG_STARS = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 80,
  size: Math.random() * 1.8 + 0.4,
  opacity: Math.random() * 0.5 + 0.1,
  tw: Math.random() * 60,
}));

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

  // Background pulse
  const bgPulse = 0.3 + 0.15 * Math.abs(Math.sin((frame * Math.PI) / 50));

  // Main text reveal
  const textSpring = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 12, stiffness: 70, mass: 1.2 },
  });
  const textScale = interpolate(textSpring, [0, 1], [0.8, 1]);
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);

  // Bottom bar slides up
  const barSpring = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const barY = interpolate(barSpring, [0, 1], [120, 0]);
  const barOpacity = interpolate(barSpring, [0, 1], [0, 1]);

  // Glow ring pulses on the text
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
        backgroundColor,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background gradient (radial, suited for vertical) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse ${isShorts ? "120% 50%" : "80% 80%"} at 50% 45%, rgba(40,0,80,0.6) 0%, rgba(0,0,30,0.4) 50%, transparent 100%)`,
        }}
      />

      {/* Nebula wash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 60% 40% at 80% 20%, rgba(0,20,100,0.25) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(60,0,100,0.2) 0%, transparent 55%)",
        }}
      />

      {/* Background stars */}
      {BG_STARS.map((s) => {
        const tw =
          0.3 + 0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / 55));
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

      {/* Floating upward particles */}
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
          opacity: textOpacity,
          transform: `scale(${textScale})`,
        }}
      >
        {/* Channel tag */}
        <div
          style={{
            fontFamily: fontSecondary,
            fontSize: isShorts ? 18 : 16,
            color: "rgba(255,68,68,0.75)",
            letterSpacing: "8px",
            textTransform: "uppercase",
            marginBottom: isShorts ? 40 : 28,
          }}
        >
          #REDSPACEFACTS
        </div>

        {/* Glow backdrop */}
        <div
          style={{
            position: "absolute",
            inset: isShorts ? "-60px -40px" : "-40px -60px",
            background: `radial-gradient(ellipse at 50% 50%, rgba(255,68,68,${glowPulse * 0.12}) 0%, transparent 70%)`,
            borderRadius: 24,
            pointerEvents: "none",
          }}
        />

        {/* Main fact text */}
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
            textShadow: `
              0 0 40px rgba(255,68,68,${glowPulse * 0.6}),
              0 0 80px rgba(255,68,68,${glowPulse * 0.3}),
              0 2px 4px rgba(0,0,0,0.8)
            `,
          }}
        >
          {text}
        </h1>

        {/* Red accent line */}
        <div
          style={{
            width: 100,
            height: 4,
            background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
            margin: "32px auto 0",
            boxShadow: `0 0 20px ${brandColor}`,
            borderRadius: 2,
          }}
        />
      </div>

      {/* Bottom branding bar */}
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
