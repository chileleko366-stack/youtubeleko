import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

const STAR_COUNT = 180;

const stars = Array.from({ length: STAR_COUNT }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2.5 + 0.5,
  opacity: Math.random() * 0.7 + 0.2,
  twinkleOffset: Math.random() * 60,
}));

export const SpaceTitle: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title zoom spring
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80, mass: 1.2 },
  });
  const titleScale = interpolate(titleSpring, [0, 1], [0.4, 1]);
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);

  // Underline draw (starts at frame 8)
  const underlineSpring = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 18, stiffness: 100 },
  });
  const underlineWidth = interpolate(underlineSpring, [0, 1], [0, 100]);

  // Subtitle fade (starts at frame 18)
  const subtitleProgress = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 20, stiffness: 90 },
  });
  const subtitleOpacity = interpolate(subtitleProgress, [0, 1], [0, 1]);
  const subtitleY = interpolate(subtitleProgress, [0, 1], [24, 0]);

  // Vignette pulse
  const vignetteOpacity = interpolate(frame, [0, 20], [1, 0.55], {
    extrapolateRight: "clamp",
  });

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
      {/* Starfield */}
      {stars.map((star) => {
        const twinkle =
          0.4 +
          0.6 *
            Math.abs(
              Math.sin(((frame + star.twinkleOffset) * Math.PI) / 40)
            );
        return (
          <div
            key={star.id}
            style={{
              position: "absolute",
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              opacity: star.opacity * twinkle,
            }}
          />
        );
      })}

      {/* Nebula gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(60,0,80,0.45) 0%, rgba(0,10,40,0.35) 55%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(0,0,8,0.85) 100%)",
          opacity: vignetteOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          padding: "0 120px",
          maxWidth: 1400,
          width: "100%",
        }}
      >
        {/* Decorative top line */}
        <div
          style={{
            width: 80,
            height: 2,
            backgroundColor: brandColor,
            margin: "0 auto 28px",
            opacity: subtitleOpacity,
          }}
        />

        {/* Main title */}
        <h1
          style={{
            fontFamily: fontPrimary,
            fontSize: 112,
            fontWeight: 900,
            color: "#ffffff",
            margin: "0 0 12px",
            letterSpacing: "4px",
            textTransform: "uppercase",
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            transformOrigin: "center center",
            textShadow: `0 0 60px rgba(255,68,68,0.4), 0 0 120px rgba(255,68,68,0.15)`,
            lineHeight: 1.05,
          }}
        >
          {text}
        </h1>

        {/* Animated underline */}
        <div
          style={{
            height: 4,
            width: `${underlineWidth}%`,
            background: `linear-gradient(90deg, ${brandColor}, rgba(255,100,100,0.3))`,
            margin: "0 auto 28px",
            borderRadius: 2,
            boxShadow: `0 0 16px ${brandColor}`,
          }}
        />

        {/* Subtitle */}
        <p
          style={{
            fontFamily: fontSecondary,
            fontSize: 28,
            color: "rgba(255,255,255,0.65)",
            margin: 0,
            letterSpacing: "8px",
            textTransform: "uppercase",
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
          }}
        >
          RED SPACE FACTS
        </p>
      </div>
    </AbsoluteFill>
  );
};
