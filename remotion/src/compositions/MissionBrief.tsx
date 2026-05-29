import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

const MISSION_STATS = [
  { label: "MISSION CLASS", value: "DEEP SPACE" },
  { label: "OBJECTIVE", value: "EXPLORATION" },
  { label: "STATUS", value: "ACTIVE" },
  { label: "PRIORITY", value: "ALPHA-1" },
];

const BG_STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.8 + 0.4,
  opacity: Math.random() * 0.5 + 0.1,
  tw: Math.random() * 50,
}));

export const MissionBrief: React.FC<CompositionProps> = ({
  text,
  statValue,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card reveal
  const cardSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);
  const cardY = interpolate(cardSpring, [0, 1], [40, 0]);

  // Header draws
  const headerSpring = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 20, stiffness: 90 },
  });
  const headerWidth = interpolate(headerSpring, [0, 1], [0, 100]);

  // Stats pop in
  const statsBase = 16;

  // Red CLASSIFIED stamp slams in at the end
  const stampFrame = Math.max(0, frame - 60);
  const stampSpring = spring({
    frame: stampFrame,
    fps,
    config: { damping: 6, stiffness: 280, mass: 0.6 },
  });
  const stampScale = interpolate(stampSpring, [0, 1], [2.5, 1]);
  const stampOpacity = interpolate(stampSpring, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });
  const stampRotate = interpolate(stampSpring, [0, 1], [-15, -8]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Stars */}
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

      {/* Grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,68,68,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,68,68,0.04) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Nebula */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(30,0,60,0.5) 0%, transparent 70%)",
        }}
      />

      {/* Main card */}
      <div
        style={{
          position: "relative",
          width: 900,
          opacity: cardOpacity,
          transform: `translateY(${cardY}px)`,
        }}
      >
        {/* Card border */}
        <div
          style={{
            border: `1px solid rgba(255,68,68,0.35)`,
            borderRadius: 4,
            padding: "48px 56px",
            background:
              "linear-gradient(135deg, rgba(20,0,40,0.85) 0%, rgba(5,0,20,0.9) 100%)",
            boxShadow:
              "0 0 60px rgba(255,68,68,0.1), inset 0 0 40px rgba(255,68,68,0.03)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Top corner accents */}
          {[
            { top: 0, left: 0 },
            { top: 0, right: 0 },
            { bottom: 0, left: 0 },
            { bottom: 0, right: 0 },
          ].map((pos, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                ...pos,
                width: 20,
                height: 20,
                borderTop: i < 2 ? `2px solid ${brandColor}` : "none",
                borderBottom: i >= 2 ? `2px solid ${brandColor}` : "none",
                borderLeft:
                  i === 0 || i === 2 ? `2px solid ${brandColor}` : "none",
                borderRight:
                  i === 1 || i === 3 ? `2px solid ${brandColor}` : "none",
              }}
            />
          ))}

          {/* Header bar */}
          <div
            style={{
              height: 2,
              width: `${headerWidth}%`,
              background: `linear-gradient(90deg, ${brandColor}, rgba(255,100,100,0.3))`,
              marginBottom: 32,
              boxShadow: `0 0 12px ${brandColor}`,
            }}
          />

          {/* Mission label */}
          <div
            style={{
              fontFamily: fontSecondary,
              fontSize: 14,
              color: brandColor,
              letterSpacing: "8px",
              textTransform: "uppercase",
              marginBottom: 16,
              opacity: cardOpacity,
            }}
          >
            MISSION BRIEFING — CLASSIFIED
          </div>

          {/* Mission title */}
          <h1
            style={{
              fontFamily: fontPrimary,
              fontSize: 72,
              fontWeight: 900,
              color: "#ffffff",
              margin: "0 0 8px",
              textTransform: "uppercase",
              letterSpacing: "4px",
              textShadow: `0 0 30px rgba(255,68,68,0.3)`,
              lineHeight: 1.05,
            }}
          >
            {text}
          </h1>

          {/* Mission designation */}
          {statValue && (
            <div
              style={{
                fontFamily: fontSecondary,
                fontSize: 22,
                color: "rgba(180,200,255,0.7)",
                letterSpacing: "4px",
                marginBottom: 40,
                textTransform: "uppercase",
              }}
            >
              {statValue}
            </div>
          )}

          {/* Divider */}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, rgba(255,68,68,0.5), transparent)",
              marginBottom: 36,
            }}
          />

          {/* Stats grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px 40px",
            }}
          >
            {MISSION_STATS.map((stat, i) => {
              const delay = statsBase + i * 5;
              const sSpring = spring({
                frame: Math.max(0, frame - delay),
                fps,
                config: { damping: 20, stiffness: 100 },
              });
              const sOpacity = interpolate(sSpring, [0, 1], [0, 1]);
              const sX = interpolate(sSpring, [0, 1], [-20, 0]);
              return (
                <div
                  key={i}
                  style={{
                    opacity: sOpacity,
                    transform: `translateX(${sX}px)`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: fontSecondary,
                      fontSize: 12,
                      color: "rgba(255,68,68,0.7)",
                      letterSpacing: "4px",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontFamily: fontPrimary,
                      fontSize: 28,
                      color: "#ffffff",
                      letterSpacing: "2px",
                    }}
                  >
                    {stat.value}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom line */}
          <div
            style={{
              height: 2,
              width: `${headerWidth}%`,
              background: `linear-gradient(270deg, ${brandColor}, rgba(255,100,100,0.3))`,
              marginTop: 36,
              marginLeft: "auto",
              boxShadow: `0 0 12px ${brandColor}`,
            }}
          />

          {/* CLASSIFIED stamp */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              right: 60,
              transform: `translate(0, -50%) scale(${stampScale}) rotate(${stampRotate}deg)`,
              opacity: stampOpacity * 0.85,
              border: `4px solid ${brandColor}`,
              padding: "8px 18px",
              borderRadius: 4,
              color: brandColor,
              fontFamily: fontPrimary,
              fontSize: 36,
              letterSpacing: "6px",
              textTransform: "uppercase",
              boxShadow: `0 0 20px rgba(255,68,68,0.4), inset 0 0 20px rgba(255,68,68,0.05)`,
              pointerEvents: "none",
            }}
          >
            CLASSIFIED
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
