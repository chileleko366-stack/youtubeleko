import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

const MINI_STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  opacity: Math.random() * 0.5 + 0.15,
  twinkleOffset: Math.random() * 60,
}));

export const PlanetReveal: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Planet grows from center
  const planetSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 70, mass: 1.4 },
  });
  const planetScale = interpolate(planetSpring, [0, 1], [0, 1]);
  const planetOpacity = interpolate(planetSpring, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Glow ring expands after planet
  const ringSpring = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 14, stiffness: 60 },
  });
  const ringScale = interpolate(ringSpring, [0, 1], [0.6, 1.25]);
  const ringOpacity = interpolate(ringSpring, [0, 0.4, 0.8, 1], [0, 0.9, 0.6, 0.4]);

  // Red pulse ring
  const pulseScale =
    1.3 + 0.15 * Math.abs(Math.sin((frame * Math.PI) / 28));
  const pulseOpacity =
    0.3 - 0.25 * Math.abs(Math.sin((frame * Math.PI) / 28));

  // Text slides in from right
  const textSpring = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 18, stiffness: 100 },
  });
  const textX = interpolate(textSpring, [0, 1], [120, 0]);
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);

  // Sub-label fade
  const subSpring = spring({
    frame: Math.max(0, frame - 28),
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const subOpacity = interpolate(subSpring, [0, 1], [0, 1]);

  const PLANET_SIZE = 380;

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
      {MINI_STARS.map((s) => {
        const tw =
          0.4 +
          0.6 *
            Math.abs(Math.sin(((frame + s.twinkleOffset) * Math.PI) / 45));
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
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}

      {/* Layout: planet left, text right */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 100,
          padding: "0 140px",
          width: "100%",
          maxWidth: 1600,
        }}
      >
        {/* Planet container */}
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            width: PLANET_SIZE,
            height: PLANET_SIZE,
          }}
        >
          {/* Pulse ring */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: `3px solid ${brandColor}`,
              transform: `scale(${pulseScale})`,
              opacity: pulseOpacity,
              boxShadow: `0 0 20px ${brandColor}`,
            }}
          />

          {/* Glow ring */}
          <div
            style={{
              position: "absolute",
              inset: -20,
              borderRadius: "50%",
              border: `6px solid rgba(255,68,68,0.5)`,
              transform: `scale(${ringScale})`,
              opacity: ringOpacity,
              boxShadow: `0 0 40px rgba(255,68,68,0.3), inset 0 0 40px rgba(255,68,68,0.1)`,
            }}
          />

          {/* Planet */}
          <div
            style={{
              width: PLANET_SIZE,
              height: PLANET_SIZE,
              borderRadius: "50%",
              background: `
                radial-gradient(ellipse 65% 55% at 35% 35%, rgba(180,100,60,0.9) 0%, transparent 60%),
                radial-gradient(ellipse 80% 80% at 50% 50%, #1a0a3e 0%, #0d0520 40%, #060210 100%)
              `,
              opacity: planetOpacity,
              transform: `scale(${planetScale})`,
              boxShadow: `
                inset -40px -40px 80px rgba(0,0,0,0.8),
                inset 20px 20px 60px rgba(100,40,160,0.3),
                0 0 60px rgba(80,20,120,0.4),
                0 0 120px rgba(40,10,60,0.2)
              `,
              overflow: "hidden",
            }}
          >
            {/* Atmosphere bands */}
            {[0.3, 0.45, 0.6, 0.72].map((yPos, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${yPos * 100}%`,
                  height: i % 2 === 0 ? 18 : 12,
                  background:
                    i % 2 === 0
                      ? "rgba(120,60,30,0.15)"
                      : "rgba(80,40,20,0.1)",
                  borderRadius: "50%",
                }}
              />
            ))}
          </div>
        </div>

        {/* Text side */}
        <div
          style={{
            flex: 1,
            opacity: textOpacity,
            transform: `translateX(${textX}px)`,
          }}
        >
          <div
            style={{
              width: 50,
              height: 3,
              backgroundColor: brandColor,
              marginBottom: 24,
              boxShadow: `0 0 12px ${brandColor}`,
            }}
          />
          <h1
            style={{
              fontFamily: fontPrimary,
              fontSize: 84,
              fontWeight: 900,
              color: "#ffffff",
              margin: "0 0 16px",
              textTransform: "uppercase",
              letterSpacing: "2px",
              lineHeight: 1.05,
              textShadow: "0 0 40px rgba(255,255,255,0.2)",
            }}
          >
            {text}
          </h1>
          <p
            style={{
              fontFamily: fontSecondary,
              fontSize: 26,
              color: "rgba(255,255,255,0.55)",
              margin: 0,
              letterSpacing: "4px",
              textTransform: "uppercase",
              opacity: subOpacity,
            }}
          >
            PLANETARY SCIENCE
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
