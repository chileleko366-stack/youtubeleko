import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

const BG_STARS = Array.from({ length: 130 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.8 + 0.3,
  opacity: Math.random() * 0.5 + 0.1,
  tw: Math.random() * 60,
}));

export const CosmicScale: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Small circle (Earth) appears first
  const earthSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const earthScale = interpolate(earthSpring, [0, 1], [0, 1]);
  const earthOpacity = interpolate(earthSpring, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Large circle (Sun/star) grows in after Earth
  const sunSpring = spring({
    frame: Math.max(0, frame - 16),
    fps,
    config: { damping: 10, stiffness: 55, mass: 1.8 },
  });
  const sunScale = interpolate(sunSpring, [0, 1], [0, 1]);
  const sunOpacity = interpolate(sunSpring, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Arrow + labels
  const labelSpring = spring({
    frame: Math.max(0, frame - 32),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1]);
  const labelY = interpolate(labelSpring, [0, 1], [20, 0]);

  // Title
  const titleSpring = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 18, stiffness: 85 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Sun glow pulse
  const sunGlow = 0.4 + 0.3 * Math.abs(Math.sin((frame * Math.PI) / 40));

  const EARTH_R = 42;
  const SUN_R = 320;

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

      {/* Nebula backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 80% at 65% 55%, rgba(60,20,0,0.3) 0%, transparent 70%), radial-gradient(ellipse 60% 60% at 20% 40%, rgba(0,10,60,0.25) 0%, transparent 65%)",
        }}
      />

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

      {/* Title at top */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
        }}
      >
        <h1
          style={{
            fontFamily: fontPrimary,
            fontSize: 52,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "6px",
            margin: 0,
            textShadow: `0 0 30px rgba(255,68,68,0.25)`,
          }}
        >
          {text}
        </h1>
        <div
          style={{
            width: 80,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
            margin: "14px auto 0",
            boxShadow: `0 0 12px ${brandColor}`,
          }}
        />
      </div>

      {/* Scale comparison */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          width: "100%",
          paddingTop: 60,
        }}
      >
        {/* Earth (small) */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginRight: 120,
            transform: `scale(${earthScale})`,
            opacity: earthOpacity,
          }}
        >
          {/* Earth circle */}
          <div
            style={{
              width: EARTH_R * 2,
              height: EARTH_R * 2,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse 65% 65% at 35% 35%, rgba(60,120,255,0.9), rgba(20,80,200,0.8) 50%, rgba(10,40,120,0.95))",
              boxShadow:
                "0 0 20px rgba(60,120,255,0.4), 0 0 40px rgba(40,80,200,0.2), inset -10px -10px 20px rgba(0,0,0,0.5)",
              border: "2px solid rgba(100,160,255,0.4)",
            }}
          />

          {/* Earth label */}
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
                fontSize: 24,
                color: "#88aaff",
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              EARTH
            </div>
            <div
              style={{
                fontFamily: fontSecondary,
                fontSize: 16,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "2px",
              }}
            >
              12,742 km
            </div>
          </div>
        </div>

        {/* "vs" indicator */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
          }}
        >
          <div
            style={{
              fontFamily: fontSecondary,
              fontSize: 22,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "6px",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            VS
          </div>
          <div
            style={{
              width: 2,
              height: 60,
              background: `linear-gradient(180deg, transparent, ${brandColor}, transparent)`,
              margin: "0 auto",
              boxShadow: `0 0 8px ${brandColor}`,
            }}
          />
          <div
            style={{
              fontFamily: fontPrimary,
              fontSize: 18,
              color: brandColor,
              letterSpacing: "4px",
              marginTop: 8,
              textAlign: "center",
            }}
          >
            109×
          </div>
        </div>

        {/* Sun (large) */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginLeft: 120,
            transform: `scale(${sunScale})`,
            opacity: sunOpacity,
          }}
        >
          {/* Outer glow */}
          <div
            style={{
              position: "absolute",
              width: SUN_R * 2 + 120,
              height: SUN_R * 2 + 120,
              borderRadius: "50%",
              background: `radial-gradient(ellipse at 50% 50%, rgba(255,160,20,${sunGlow * 0.2}) 0%, transparent 70%)`,
              top: -60,
              left: -60,
            }}
          />

          {/* Sun circle */}
          <div
            style={{
              width: SUN_R * 2,
              height: SUN_R * 2,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse 60% 55% at 40% 35%, #fff2aa 0%, #ffcc44 25%, #ff8800 55%, #cc4400 80%, #660000 100%)",
              boxShadow: `
                0 0 60px rgba(255,160,20,${sunGlow * 0.6}),
                0 0 120px rgba(255,100,0,${sunGlow * 0.4}),
                0 0 200px rgba(255,60,0,${sunGlow * 0.2}),
                inset -60px -60px 100px rgba(150,0,0,0.4)
              `,
            }}
          />

          {/* Sun label */}
          <div
            style={{
              marginTop: 24,
              textAlign: "center",
              opacity: labelOpacity,
              transform: `translateY(${labelY}px)`,
            }}
          >
            <div
              style={{
                fontFamily: fontPrimary,
                fontSize: 32,
                color: "#ffcc44",
                letterSpacing: "3px",
                textTransform: "uppercase",
                textShadow: "0 0 20px rgba(255,200,60,0.5)",
              }}
            >
              THE SUN
            </div>
            <div
              style={{
                fontFamily: fontSecondary,
                fontSize: 18,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "2px",
              }}
            >
              1,392,700 km
            </div>
          </div>
        </div>
      </div>

      {/* Bottom watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity * 0.5,
        }}
      >
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
