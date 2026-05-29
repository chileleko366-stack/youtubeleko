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
import { easeInOutCubic, easeOutElastic } from "../lib/easing";

const MILESTONES = [
  { year: "13.8B", label: "Big Bang", era: "ORIGINS" },
  { year: "13.6B", label: "First Stars", era: "ORIGINS" },
  { year: "4.6B", label: "Solar System", era: "SOLAR" },
  { year: "3.8B", label: "First Life", era: "LIFE" },
  { year: "0.3M", label: "Homo Sapiens", era: "LIFE" },
];

// Deterministic star field
const BG_STARS = Array.from({ length: 150 }, (_, i) => ({
  id: i,
  x: random(`ct-x-${i}`) * 100,
  y: random(`ct-y-${i}`) * 100,
  size: random(`ct-s-${i}`) * 2 + 0.4,
  opacity: random(`ct-o-${i}`) * 0.6 + 0.15,
  twinkle: random(`ct-t-${i}`) * 60,
  speed: 35 + random(`ct-sp-${i}`) * 30,
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

  // Timeline line draws left-to-right with easeInOutCubic
  const rawLineProg = interpolate(frame, [0, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineProgress = easeInOutCubic(rawLineProg);
  const lineWidth = lineProgress * 100;

  // Leading dot position (the glowing leading edge)
  const leadingX = lineWidth;

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
        backgroundColor: "#00000c",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Stars — deterministic */}
      {BG_STARS.map((s) => {
        const tw =
          0.35 +
          0.65 *
            Math.abs(Math.sin(((frame + s.twinkle) * Math.PI) / s.speed));
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
        {/* Era brackets above the line */}
        <div
          style={{
            position: "absolute",
            top: -52,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "space-between",
            pointerEvents: "none",
            opacity: titleOpacity,
          }}
        >
          {["ORIGINS", "SOLAR ERA", "LIFE"].map((era, i) => {
            const positions = [[0, 33], [33, 55], [55, 100]];
            const [start, end] = positions[i];
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${start}%`,
                  width: `${end - start}%`,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: fontSecondary,
                    fontSize: 11,
                    color: `rgba(255,68,68,0.5)`,
                    letterSpacing: "4px",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {era}
                </div>
                <div
                  style={{
                    height: 1,
                    background: `linear-gradient(90deg, transparent, rgba(255,68,68,0.3), transparent)`,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Timeline base line */}
        <div
          style={{
            position: "relative",
            height: 3,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 2,
          }}
        >
          {/* Animated gradient line — brand red at leading edge, fading back */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${lineWidth}%`,
              background: `linear-gradient(90deg, rgba(80,0,0,0.6) 0%, rgba(180,20,0,0.8) 60%, ${brandColor} 100%)`,
              borderRadius: 2,
              boxShadow: `0 0 10px rgba(255,68,68,0.4)`,
            }}
          />

          {/* Glowing leading edge dot */}
          {lineWidth > 0 && lineWidth < 100 && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: `${leadingX}%`,
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: "#ffffff",
                transform: "translate(-50%, -50%)",
                boxShadow: `0 0 16px #ffffff, 0 0 32px ${brandColor}, 0 0 48px rgba(255,68,68,0.4)`,
              }}
            />
          )}
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
            // Milestone pops in with easeOutElastic when line reaches it
            const milestoneX = (i / (MILESTONES.length - 1)) * 100;
            const lineReachesAt = (milestoneX / 100) * 50; // map to frame range 0-50
            const dotDelay = lineReachesAt;

            const rawDotProg = interpolate(
              frame,
              [dotDelay, dotDelay + 10],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const dotScale = easeOutElastic(rawDotProg);
            const dotOpacity = interpolate(rawDotProg, [0, 0.2], [0, 1], {
              extrapolateRight: "clamp",
            });

            const labelDelay = dotDelay + 4;
            const labelSpring = spring({
              frame: Math.max(0, frame - labelDelay),
              fps,
              config: { damping: 18, stiffness: 100 },
            });
            const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1]);
            const labelY = interpolate(labelSpring, [0, 1], [20, 0]);
            const labelBlur = interpolate(labelSpring, [0, 1], [4, 0]);

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  position: "relative",
                }}
              >
                {/* Dot — pops in with easeOutElastic */}
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

                {/* Labels below dot — blur-to-sharp */}
                <div
                  style={{
                    marginTop: 20,
                    textAlign: "center",
                    opacity: labelOpacity,
                    transform: `translateY(${labelY}px)`,
                    filter: `blur(${labelBlur}px)`,
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
