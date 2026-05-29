import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

const MILESTONES = [
  { year: "13.8B", label: "Big Bang" },
  { year: "13.6B", label: "First Stars" },
  { year: "4.6B", label: "Solar System" },
  { year: "3.8B", label: "First Life" },
  { year: "0.3M", label: "Homo Sapiens" },
];

const BG_STARS = Array.from({ length: 150 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.4,
  opacity: Math.random() * 0.6 + 0.15,
  twinkle: Math.random() * 60,
}));

export const CosmicTimeline: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Timeline line draws from left
  const lineSpring = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 55 },
  });
  const lineWidth = interpolate(lineSpring, [0, 1], [0, 100]);

  // Title fades in
  const titleSpring = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [-30, 0]);

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
      {/* Stars */}
      {BG_STARS.map((s) => {
        const tw =
          0.35 +
          0.65 *
            Math.abs(Math.sin(((frame + s.twinkle) * Math.PI) / 50));
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

      {/* Nebula gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 60% at 50% 50%, rgba(40,0,80,0.4) 0%, rgba(0,10,50,0.3) 50%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 35%, rgba(0,0,8,0.8) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Title */}
      <div
        style={{
          position: "relative",
          fontFamily: fontPrimary,
          fontSize: 56,
          fontWeight: 900,
          color: "#ffffff",
          textTransform: "uppercase",
          letterSpacing: "6px",
          textAlign: "center",
          marginBottom: 60,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          textShadow: `0 0 30px rgba(255,68,68,0.3)`,
        }}
      >
        {text}
        <div
          style={{
            width: 80,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
            margin: "16px auto 0",
            boxShadow: `0 0 12px ${brandColor}`,
          }}
        />
      </div>

      {/* Timeline container */}
      <div
        style={{
          position: "relative",
          width: "80%",
          maxWidth: 1400,
        }}
      >
        {/* Timeline base line */}
        <div
          style={{
            position: "relative",
            height: 3,
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 2,
            marginBottom: 0,
          }}
        >
          {/* Animated line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${lineWidth}%`,
              background: `linear-gradient(90deg, ${brandColor}, rgba(120,40,255,0.7))`,
              borderRadius: 2,
              boxShadow: `0 0 16px ${brandColor}, 0 0 40px rgba(255,68,68,0.3)`,
            }}
          />
        </div>

        {/* Milestones */}
        <div
          style={{
            position: "absolute",
            top: -10,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          {MILESTONES.map((m, i) => {
            const delay = 8 + i * 6;
            const dotSpring = spring({
              frame: Math.max(0, frame - delay),
              fps,
              config: { damping: 8, stiffness: 180 },
            });
            const dotScale = interpolate(dotSpring, [0, 1], [0, 1]);
            const dotOpacity = interpolate(dotSpring, [0, 0.3], [0, 1], {
              extrapolateRight: "clamp",
            });
            const labelSpring = spring({
              frame: Math.max(0, frame - delay - 4),
              fps,
              config: { damping: 18, stiffness: 100 },
            });
            const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1]);
            const labelY = interpolate(labelSpring, [0, 1], [20, 0]);

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  position: "relative",
                  top: 0,
                }}
              >
                {/* Dot */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    backgroundColor: brandColor,
                    border: "3px solid #ffffff",
                    boxShadow: `0 0 20px ${brandColor}, 0 0 40px rgba(255,68,68,0.4)`,
                    transform: `scale(${dotScale})`,
                    opacity: dotOpacity,
                  }}
                />

                {/* Labels below dot */}
                <div
                  style={{
                    marginTop: 20,
                    textAlign: "center",
                    opacity: labelOpacity,
                    transform: `translateY(${labelY}px)`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: fontPrimary,
                      fontSize: 22,
                      color: brandColor,
                      letterSpacing: "1px",
                      lineHeight: 1,
                      marginBottom: 6,
                    }}
                  >
                    {m.year}
                  </div>
                  <div
                    style={{
                      fontFamily: fontSecondary,
                      fontSize: 16,
                      color: "rgba(255,255,255,0.65)",
                      letterSpacing: "2px",
                      textTransform: "uppercase",
                      maxWidth: 110,
                    }}
                  >
                    {m.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          position: "relative",
          marginTop: 140,
          fontFamily: fontSecondary,
          fontSize: 18,
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "6px",
          textTransform: "uppercase",
          opacity: titleOpacity,
        }}
      >
        COSMIC CHRONOLOGY — CH6
      </div>
    </AbsoluteFill>
  );
};
