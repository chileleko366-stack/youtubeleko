import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

type Star = {
  id: number;
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  driftX: number;
  driftY: number;
  color: string;
};

const COLORS = ["#ffffff", "#ffe8cc", "#cce0ff", "#ffcccc", "#e0ccff"];

const makeStars = (count: number): Star[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.pow(Math.random(), 2.5) * 4 + 0.4,
    baseOpacity: Math.random() * 0.6 + 0.15,
    twinkleSpeed: 25 + Math.random() * 50,
    twinkleOffset: Math.random() * 100,
    driftX: (Math.random() - 0.5) * 0.008,
    driftY: (Math.random() - 0.5) * 0.008,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

const STARS = makeStars(220);

export const StarField: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textSpring = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 16, stiffness: 90 },
  });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textScale = interpolate(textSpring, [0, 1], [0.92, 1]);

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
      {STARS.map((star) => {
        const twinkle =
          0.3 +
          0.7 *
            Math.abs(
              Math.sin(
                ((frame + star.twinkleOffset) * Math.PI) / star.twinkleSpeed
              )
            );
        const cx = star.x + star.driftX * frame;
        const cy = star.y + star.driftY * frame;
        const glow = star.size > 2.5;
        return (
          <div
            key={star.id}
            style={{
              position: "absolute",
              left: `${cx}%`,
              top: `${cy}%`,
              width: star.size,
              height: star.size,
              borderRadius: "50%",
              backgroundColor: star.color,
              opacity: star.baseOpacity * twinkle,
              boxShadow: glow
                ? `0 0 ${star.size * 3}px ${star.size}px ${star.color}`
                : undefined,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}

      {/* Milky way band */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, transparent 20%, rgba(100,60,160,0.08) 40%, rgba(80,40,140,0.12) 50%, rgba(100,60,160,0.08) 60%, transparent 80%)",
          pointerEvents: "none",
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 35%, rgba(0,0,8,0.7) 100%)",
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
          transform: `scale(${textScale})`,
        }}
      >
        {/* Glow backdrop */}
        <div
          style={{
            position: "absolute",
            inset: -40,
            background:
              "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,0,20,0.75) 0%, transparent 100%)",
            borderRadius: 24,
          }}
        />
        <div
          style={{
            position: "relative",
            fontFamily: fontPrimary,
            fontSize: 80,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "4px",
            textShadow: `0 0 40px rgba(255,255,255,0.3)`,
            lineHeight: 1.1,
          }}
        >
          {text}
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
            fontSize: 22,
            color: "rgba(255,255,255,0.5)",
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
