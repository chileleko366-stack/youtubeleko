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

// Deterministic star fields for each side
const LEFT_STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: random(`ssl-x-${i}`) * 50,
  y: random(`ssl-y-${i}`) * 100,
  size: random(`ssl-s-${i}`) * 1.8 + 0.3,
  opacity: random(`ssl-o-${i}`) * 0.5 + 0.15,
  tw: random(`ssl-t-${i}`) * 60,
  speed: 30 + random(`ssl-sp-${i}`) * 40,
}));

const RIGHT_STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: 50 + random(`ssr-x-${i}`) * 50,
  y: random(`ssr-y-${i}`) * 100,
  size: random(`ssr-s-${i}`) * 1.8 + 0.3,
  opacity: random(`ssr-o-${i}`) * 0.5 + 0.15,
  tw: random(`ssr-t-${i}`) * 60,
  speed: 30 + random(`ssr-sp-${i}`) * 40,
}));

// Particle stream flowing down the divider line
const DIVIDER_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  phase: (i / 12) * 100,
  speed: 0.8 + random(`dp-sp-${i}`) * 0.6,
  opacity: 0.4 + random(`dp-o-${i}`) * 0.5,
}));

export const SpaceSplitScreen: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftLabel = bullets?.[0] ?? "BEFORE";
  const rightLabel = bullets?.[1] ?? "AFTER";
  const leftSub = bullets?.[2] ?? "THE PAST";
  const rightSub = bullets?.[3] ?? "THE FUTURE";

  // Left panel: slides in from -100% with spring + blur-to-sharp
  const leftSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const leftOpacity = interpolate(leftSpring, [0, 1], [0, 1]);
  const leftX = interpolate(leftSpring, [0, 1], [-100, 0]);
  const leftBlur = interpolate(leftSpring, [0, 1], [20, 0]);

  // Right panel: from +100%
  const rightSpring = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const rightOpacity = interpolate(rightSpring, [0, 1], [0, 1]);
  const rightX = interpolate(rightSpring, [0, 1], [100, 0]);
  const rightBlur = interpolate(rightSpring, [0, 1], [20, 0]);

  // Divider: WIPE from center outward (both up and down simultaneously)
  // using clip-path: inset to reveal from center
  const dividerSpring = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 20, stiffness: 70 },
  });
  const dividerReveal = interpolate(dividerSpring, [0, 1], [50, 0]);

  // Subtle parallax: panels drift slowly in opposite directions after settling
  const settleProgress = Math.min(1, interpolate(leftSpring, [0.85, 1], [0, 1]));
  const parallaxDrift = settleProgress * Math.sin((frame * Math.PI) / 150) * 4;

  // Title
  const titleSpring = spring({
    frame: Math.max(0, frame - 22),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [20, 0]);

  // Text word-by-word reveal after panels settle (frame ~20)
  const leftWords = leftLabel.split(" ");
  const rightWords = rightLabel.split(" ");

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#00000a",
        overflow: "hidden",
      }}
    >
      {/* Left side stars */}
      {LEFT_STARS.map((s) => {
        const tw =
          0.3 + 0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / s.speed));
        return (
          <div
            key={`l${s.id}`}
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

      {/* Right side stars */}
      {RIGHT_STARS.map((s) => {
        const tw =
          0.3 + 0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / s.speed));
        return (
          <div
            key={`r${s.id}`}
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

      {/* Left panel — animated gradient nebula (blue scheme) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          background:
            "radial-gradient(ellipse 120% 80% at 30% 50%, rgba(0,20,80,0.5) 0%, rgba(0,5,40,0.4) 60%, transparent 100%)",
          opacity: leftOpacity,
          transform: `translateX(${leftX}px) translateX(${-parallaxDrift}px)`,
          filter: `blur(${leftBlur}px)`,
        }}
      />

      {/* Right panel — animated gradient nebula (red/purple scheme) */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "50%",
          height: "100%",
          background:
            "radial-gradient(ellipse 120% 80% at 70% 50%, rgba(60,0,100,0.5) 0%, rgba(40,0,60,0.4) 60%, transparent 100%)",
          opacity: rightOpacity,
          transform: `translateX(${rightX}px) translateX(${parallaxDrift}px)`,
          filter: `blur(${rightBlur}px)`,
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

      {/* Left content — staggered word-by-word after panel settles */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: leftOpacity,
          transform: `translateX(${leftX}px) translateX(${-parallaxDrift}px)`,
        }}
      >
        <div style={{ textAlign: "center", padding: "0 60px" }}>
          <div
            style={{
              fontFamily: fontSecondary,
              fontSize: 16,
              color: "rgba(100,150,255,0.7)",
              letterSpacing: "8px",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            {leftSub}
          </div>
          <div
            style={{
              fontFamily: fontPrimary,
              fontSize: 88,
              fontWeight: 900,
              color: "#aaccff",
              textTransform: "uppercase",
              letterSpacing: "4px",
              lineHeight: 1.05,
              textShadow: "0 0 40px rgba(100,150,255,0.3)",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0 0.2em",
            }}
          >
            {leftWords.map((word, wi) => {
              const wDelay = 18 + wi * 4;
              const wProg = interpolate(frame, [wDelay, wDelay + 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <span
                  key={wi}
                  style={{
                    display: "inline-block",
                    opacity: wProg,
                    transform: `translateY(${interpolate(wProg, [0, 1], [10, 0])}px)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
          <div
            style={{
              width: 60,
              height: 3,
              backgroundColor: "rgba(100,150,255,0.5)",
              margin: "24px auto 0",
              boxShadow: "0 0 12px rgba(100,150,255,0.4)",
            }}
          />
        </div>
      </div>

      {/* Right content */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "50%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: rightOpacity,
          transform: `translateX(${rightX}px) translateX(${parallaxDrift}px)`,
        }}
      >
        <div style={{ textAlign: "center", padding: "0 60px" }}>
          <div
            style={{
              fontFamily: fontSecondary,
              fontSize: 16,
              color: "rgba(255,100,100,0.7)",
              letterSpacing: "8px",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            {rightSub}
          </div>
          <div
            style={{
              fontFamily: fontPrimary,
              fontSize: 88,
              fontWeight: 900,
              color: "#ff8888",
              textTransform: "uppercase",
              letterSpacing: "4px",
              lineHeight: 1.05,
              textShadow: `0 0 40px rgba(255,68,68,0.35)`,
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0 0.2em",
            }}
          >
            {rightWords.map((word, wi) => {
              const wDelay = 22 + wi * 4;
              const wProg = interpolate(frame, [wDelay, wDelay + 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <span
                  key={wi}
                  style={{
                    display: "inline-block",
                    opacity: wProg,
                    transform: `translateY(${interpolate(wProg, [0, 1], [10, 0])}px)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
          <div
            style={{
              width: 60,
              height: 3,
              backgroundColor: brandColor,
              margin: "24px auto 0",
              boxShadow: `0 0 12px ${brandColor}`,
            }}
          />
        </div>
      </div>

      {/* Center divider line — WIPES from center outward using clip-path */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 4,
          transform: "translateX(-50%)",
          background: `linear-gradient(180deg, transparent, ${brandColor} 10%, ${brandColor} 90%, transparent)`,
          boxShadow: `0 0 20px ${brandColor}, 0 0 40px rgba(255,68,68,0.3)`,
          clipPath: `inset(${dividerReveal}% 0 ${dividerReveal}% 0)`,
        }}
      />

      {/* Center dot on line */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: brandColor,
          boxShadow: `0 0 20px ${brandColor}, 0 0 40px rgba(255,68,68,0.5)`,
          opacity: dividerReveal < 20 ? 1 : 0,
        }}
      />

      {/* Particle stream flowing down the divider */}
      {DIVIDER_PARTICLES.map((p) => {
        const particleY = ((((p.phase + frame * p.speed) % 100) + 100) % 100);
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: "50%",
              top: `${particleY}%`,
              width: 3,
              height: 3,
              borderRadius: "50%",
              backgroundColor: brandColor,
              transform: "translateX(-50%)",
              opacity: p.opacity * (dividerReveal < 30 ? 1 : 0),
              boxShadow: `0 0 6px ${brandColor}`,
            }}
          />
        );
      })}

      {/* Bottom title */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <h2
          style={{
            fontFamily: fontPrimary,
            fontSize: 44,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "6px",
            margin: "0 0 8px",
            textShadow: `0 0 20px rgba(255,68,68,0.2)`,
          }}
        >
          {text}
        </h2>
        <div
          style={{
            fontFamily: fontSecondary,
            fontSize: 16,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "5px",
            textTransform: "uppercase",
          }}
        >
          RED SPACE FACTS — CH6
        </div>
      </div>
    </AbsoluteFill>
  );
};
