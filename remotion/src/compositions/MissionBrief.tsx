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

const MISSION_STATS = [
  { label: "MISSION CLASS", value: "DEEP SPACE" },
  { label: "OBJECTIVE", value: "EXPLORATION" },
  { label: "STATUS", value: "ACTIVE" },
  { label: "PRIORITY", value: "ALPHA-1" },
];

// Deterministic star field
const BG_STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  x: random(`mb-x-${i}`) * 100,
  y: random(`mb-y-${i}`) * 100,
  size: random(`mb-s-${i}`) * 1.8 + 0.4,
  opacity: random(`mb-o-${i}`) * 0.5 + 0.1,
  tw: random(`mb-t-${i}`) * 50,
  speed: 30 + random(`mb-sp-${i}`) * 40,
}));

// Warning text for typewriter
const WARNING_TEXT = "THIS DOCUMENT CONTAINS CLASSIFIED INFORMATION. UNAUTHORIZED ACCESS IS PROHIBITED.";

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

  // SVG border draws around 4 sides sequentially (top → right → bottom → left)
  // Total perimeter: 2*(900-padding) + 2*(height)
  const CARD_W = 900;
  const CARD_H = 520;
  const perim = 2 * (CARD_W + CARD_H);
  const borderProg = interpolate(frame, [4, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const borderDash = borderProg * perim;

  // Stats pop in
  const statsBase = 16;

  // Red CLASSIFIED stamp slams in at frame 60 with spring bounce
  const stampFrame = Math.max(0, frame - 58);
  const stampSpring = spring({
    frame: stampFrame,
    fps,
    config: { damping: 6, stiffness: 280, mass: 0.6 },
  });
  const stampScale = interpolate(stampSpring, [0, 1], [2.5, 1]);
  const stampOpacity = interpolate(stampSpring, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });
  const stampRotate = interpolate(stampSpring, [0, 1], [-15, -12]);

  // Scanning bar sweeps twice across the panel
  const scanX = interpolate(
    frame % 45,
    [0, 45],
    [-10, 110],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const scanOpacity = frame >= 10
    ? interpolate(frame % 45, [0, 3, 40, 45], [0, 0.6, 0.6, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // Typewriter warning text
  const warningDelay = 50;
  const warningChars = Math.floor(
    interpolate(frame, [warningDelay, warningDelay + 35], [0, WARNING_TEXT.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const warningText = WARNING_TEXT.slice(0, warningChars);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000008",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Stars — deterministic */}
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

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 30%, rgba(0,0,8,0.75) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Main card */}
      <div
        style={{
          position: "relative",
          width: CARD_W,
          opacity: cardOpacity,
          transform: `translateY(${cardY}px)`,
        }}
      >
        {/* SVG border that draws around all 4 sides */}
        <svg
          viewBox={`0 0 ${CARD_W} ${CARD_H}`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          <rect
            x={1}
            y={1}
            width={CARD_W - 2}
            height={CARD_H - 2}
            fill="none"
            stroke={brandColor}
            strokeWidth={2}
            strokeDasharray={perim}
            strokeDashoffset={perim - borderDash}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${brandColor})` }}
          />
        </svg>

        {/* Card inner */}
        <div
          style={{
            padding: "48px 56px",
            background:
              "linear-gradient(135deg, rgba(20,0,40,0.9) 0%, rgba(5,0,20,0.95) 100%)",
            boxShadow:
              "0 0 60px rgba(255,68,68,0.08), inset 0 0 40px rgba(255,68,68,0.02)",
            position: "relative",
            overflow: "hidden",
            height: CARD_H,
            boxSizing: "border-box",
          }}
        >
          {/* Corner accent brackets */}
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
                borderLeft: i === 0 || i === 2 ? `2px solid ${brandColor}` : "none",
                borderRight: i === 1 || i === 3 ? `2px solid ${brandColor}` : "none",
                opacity: 0.7,
              }}
            />
          ))}

          {/* CRT scanning bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${scanX}%`,
              width: "8%",
              background:
                "linear-gradient(90deg, transparent, rgba(0,255,60,0.07), rgba(0,255,60,0.12), rgba(0,255,60,0.07), transparent)",
              opacity: scanOpacity,
              pointerEvents: "none",
            }}
          />

          {/* Mission label */}
          <div
            style={{
              fontFamily: fontSecondary,
              fontSize: 13,
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
                fontSize: 20,
                color: "rgba(180,200,255,0.7)",
                letterSpacing: "4px",
                marginBottom: 28,
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
              background: "linear-gradient(90deg, rgba(255,68,68,0.5), transparent)",
              marginBottom: 28,
            }}
          />

          {/* Stats grid — each slides in from left with 6-frame stagger */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px 40px",
              marginBottom: 20,
            }}
          >
            {MISSION_STATS.map((stat, i) => {
              const delay = statsBase + i * 6;
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
                  style={{ opacity: sOpacity, transform: `translateX(${sX}px)` }}
                >
                  <div
                    style={{
                      fontFamily: fontSecondary,
                      fontSize: 11,
                      color: "rgba(255,68,68,0.7)",
                      letterSpacing: "4px",
                      textTransform: "uppercase",
                      marginBottom: 5,
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontFamily: fontPrimary,
                      fontSize: 26,
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

          {/* Typewriter warning at bottom */}
          <div
            style={{
              fontFamily: fontSecondary,
              fontSize: 11,
              color: "rgba(255,68,68,0.45)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              minHeight: 16,
            }}
          >
            {warningText}
            {warningChars < WARNING_TEXT.length && (
              <span style={{ opacity: frame % 4 < 2 ? 1 : 0 }}>_</span>
            )}
          </div>

          {/* CLASSIFIED stamp — rotates in with spring bounce */}
          <div
            style={{
              position: "absolute",
              top: "42%",
              right: 56,
              transform: `translate(0, -50%) scale(${stampScale}) rotate(${stampRotate}deg)`,
              opacity: stampOpacity * 0.85,
              border: `4px solid ${brandColor}`,
              padding: "8px 18px",
              borderRadius: 4,
              color: brandColor,
              fontFamily: fontPrimary,
              fontSize: 34,
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
