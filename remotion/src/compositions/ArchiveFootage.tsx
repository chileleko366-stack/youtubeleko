import React from "react";
import {
  AbsoluteFill,
  interpolate,
  noise2D,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const ArchiveFootage: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enterProgress = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 60 },
  });

  const textProgress = spring({
    frame: frame - 15,
    fps,
    config: { damping: 22, stiffness: 80 },
  });

  const opacity = interpolate(enterProgress, [0, 1], [0, 1]);
  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);
  const textY = interpolate(textProgress, [0, 1], [20, 0]);

  // Sepia-like color overlay using noise for grain simulation
  const grainOpacity = (noise2D("grain", frame * 0.5, 0) + 1) * 0.05;

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor, opacity: opacity * fadeOut }}>
      {/* Sepia vignette overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 40%, #3d2b1a88 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Simulated aged film area */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, #c8a24b08 0%, #1a100800 50%, #c8a24b0a 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Film grain overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(200,162,75,${grainOpacity})`,
          pointerEvents: "none",
          mixBlendMode: "overlay",
        }}
      />

      {/* Horizontal scratch lines */}
      {[0.2, 0.55, 0.78].map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${pos * 100}%`,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: "#ffffff18",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Caption box at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
          padding: "80px 120px 60px",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        {/* Date/source tag */}
        <div
          style={{
            fontFamily: "Courier New, monospace",
            fontSize: 20,
            color: brandColor,
            marginBottom: 16,
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          ARCHIVAL RECORD
        </div>

        <p
          style={{
            fontFamily: fontSecondary,
            fontSize: 40,
            color: "#f5f0e0",
            margin: 0,
            lineHeight: 1.4,
            fontStyle: "italic",
            textShadow: "0 2px 12px rgba(0,0,0,0.9)",
          }}
        >
          {text}
        </p>
      </div>

      {/* Border frame (film strip edge) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: "12px solid #000000",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
