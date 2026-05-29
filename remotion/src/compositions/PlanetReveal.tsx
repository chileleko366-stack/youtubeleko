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
import { easeOutBack } from "../lib/easing";

export const PlanetReveal: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Planet grows from 0 scale with easeOutBack spring (slight bounce overshoot)
  const planetRawSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 100, mass: 1.2 },
  });
  const planetScale = easeOutBack(Math.min(planetRawSpring, 1));
  const planetOpacity = interpolate(planetRawSpring, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Atmosphere ring rotation angles
  const ring1Angle = frame * 0.5;
  const ring2Angle = -(frame * 0.32);
  const ring3Angle = frame * 0.18;

  // Glow ring pulsing
  const glowPulse1 = 0.4 + 0.3 * Math.abs(Math.sin((frame * Math.PI) / 32));
  const glowPulse2 = 0.3 + 0.35 * Math.abs(Math.sin((frame * Math.PI) / 44 + 1));

  // Lens flare appears after planet is revealed
  const lensFlareSpring = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const lensFlareOpacity = interpolate(lensFlareSpring, [0, 1], [0, 1]);

  // Title slides in from left
  const titleSpring = spring({
    frame: Math.max(0, frame - 14),
    fps,
    config: { damping: 18, stiffness: 100 },
  });
  const titleX = interpolate(titleSpring, [0, 1], [-120, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Subtitle slides in from right
  const subSpring = spring({
    frame: Math.max(0, frame - 22),
    fps,
    config: { damping: 18, stiffness: 100 },
  });
  const subX = interpolate(subSpring, [0, 1], [120, 0]);
  const subOpacity = interpolate(subSpring, [0, 1], [0, 1]);

  const PLANET_SIZE = 380;
  const HALF = PLANET_SIZE / 2;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#00000a",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Nebula background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 80% at 50% 50%, rgba(20,0,50,0.6) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 15% 70%, rgba(0,10,60,0.4) 0%, transparent 60%),
            radial-gradient(ellipse 40% 50% at 85% 30%, rgba(60,0,30,0.35) 0%, transparent 55%)
          `,
        }}
      />

      {/* Stars behind: ParticleField */}
      <ParticleField count={100} speedMultiplier={0.2} sizeRange={[0.3, 1.8]} />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 30%, rgba(0,0,8,0.85) 100%)",
          pointerEvents: "none",
        }}
      />

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
            transform: `scale(${planetScale})`,
            opacity: planetOpacity,
          }}
        >
          {/* Multiple box-shadow glow ring layers */}
          <div
            style={{
              position: "absolute",
              inset: -30,
              borderRadius: "50%",
              boxShadow: `
                0 0 40px rgba(255,68,68,${glowPulse1 * 0.25}),
                0 0 80px rgba(255,68,68,${glowPulse1 * 0.15}),
                0 0 140px rgba(120,20,255,${glowPulse2 * 0.15})
              `,
            }}
          />

          {/* Atmosphere rings: SVG ellipses rotating around planet */}
          <svg
            viewBox={`0 0 ${PLANET_SIZE} ${PLANET_SIZE}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              overflow: "visible",
            }}
          >
            {/* Ring 1 */}
            <ellipse
              cx={HALF}
              cy={HALF}
              rx={HALF + 40}
              ry={22}
              fill="none"
              stroke={`rgba(180,100,255,0.35)`}
              strokeWidth={6}
              transform={`rotate(${ring1Angle}, ${HALF}, ${HALF})`}
            />
            {/* Ring 2 */}
            <ellipse
              cx={HALF}
              cy={HALF}
              rx={HALF + 70}
              ry={18}
              fill="none"
              stroke={`rgba(100,160,255,0.2)`}
              strokeWidth={3}
              transform={`rotate(${ring2Angle}, ${HALF}, ${HALF})`}
            />
            {/* Ring 3 */}
            <ellipse
              cx={HALF}
              cy={HALF}
              rx={HALF + 20}
              ry={28}
              fill="none"
              stroke={`rgba(255,100,80,0.18)`}
              strokeWidth={4}
              transform={`rotate(${ring3Angle}, ${HALF}, ${HALF})`}
            />
          </svg>

          {/* Planet */}
          <div
            style={{
              width: PLANET_SIZE,
              height: PLANET_SIZE,
              borderRadius: "50%",
              background: `
                radial-gradient(ellipse 40% 35% at 65% 30%, rgba(255,240,220,0.85) 0%, transparent 35%),
                radial-gradient(ellipse 65% 55% at 35% 35%, rgba(180,100,60,0.9) 0%, transparent 60%),
                radial-gradient(ellipse 80% 80% at 50% 50%, #1a0a3e 0%, #0d0520 40%, #060210 100%)
              `,
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

          {/* Lens flare at bright spot */}
          <div
            style={{
              position: "absolute",
              top: "18%",
              left: "60%",
              opacity: lensFlareOpacity * 0.7,
              pointerEvents: "none",
            }}
          >
            {/* Horizontal bar */}
            <div
              style={{
                position: "absolute",
                width: 32,
                height: 2,
                background: "linear-gradient(90deg, transparent, rgba(255,255,220,0.8), transparent)",
                top: -1,
                left: -16,
              }}
            />
            {/* Vertical bar */}
            <div
              style={{
                position: "absolute",
                width: 2,
                height: 32,
                background: "linear-gradient(180deg, transparent, rgba(255,255,220,0.8), transparent)",
                top: -16,
                left: -1,
              }}
            />
            {/* Center dot */}
            <div
              style={{
                position: "absolute",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.9)",
                top: -3,
                left: -3,
                boxShadow: "0 0 8px rgba(255,255,200,0.8)",
              }}
            />
          </div>
        </div>

        {/* Text side — splits into title from left + subtitle from right */}
        <div style={{ flex: 1 }}>
          {/* Title from left */}
          <div
            style={{
              opacity: titleOpacity,
              transform: `translateX(${titleX}px)`,
              marginBottom: 16,
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
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "2px",
                lineHeight: 1.05,
                textShadow: `0 0 40px rgba(255,255,255,0.2), 0 0 80px rgba(180,80,255,0.15)`,
              }}
            >
              {text}
            </h1>
          </div>

          {/* Subtitle from right */}
          <div
            style={{
              opacity: subOpacity,
              transform: `translateX(${subX}px)`,
            }}
          >
            <p
              style={{
                fontFamily: fontSecondary,
                fontSize: 26,
                color: "rgba(255,255,255,0.55)",
                margin: 0,
                letterSpacing: "4px",
                textTransform: "uppercase",
              }}
            >
              PLANETARY SCIENCE
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
