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

  // Film grain using noise
  const grainOpacity = (noise2D("grain", frame * 0.5, 0) + 1) * 0.05;

  // Color shift: sepia → normal → sepia cycle
  const sepiaAmount = interpolate(
    Math.sin(frame * 0.03),
    [-1, 1],
    [0.4, 0.8]
  );

  // Vignette pulse
  const vignetteOpacity = interpolate(
    Math.sin(frame * 0.04),
    [-1, 1],
    [0.55, 0.75]
  );

  // Occasional film skip: white flash every ~60 frames for 1 frame
  const filmSkip = interpolate(
    frame % 60,
    [0, 1, 2, 60],
    [0, 0.15, 0, 0],
    { extrapolateRight: "clamp" }
  );

  // Timestamp counter
  const baseSeconds = 3600 * 12 + 240;
  const secondsElapsed = Math.floor(frame / fps);
  const totalSeconds = baseSeconds + secondsElapsed;
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  const timestamp = `${hh}:${mm}:${ss}`;

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Sprocket hole count
  const numSprockets = 8;

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        opacity: opacity * fadeOut,
        filter: `sepia(${sepiaAmount}) contrast(1.1) brightness(0.9)`,
      }}
    >
      {/* Sepia/aged tone overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, #c8a24b08 0%, transparent 50%, #c8a24b0a 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Film grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(200,162,75,${grainOpacity})`,
          pointerEvents: "none",
          mixBlendMode: "overlay",
        }}
      />

      {/* Pulsing vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
          pointerEvents: "none",
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

      {/* Film skip flash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(255,255,255,${filmSkip})`,
          pointerEvents: "none",
        }}
      />

      {/* Sprocket holes — left edge */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 44,
          backgroundColor: "#000000",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-evenly",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        {Array.from({ length: numSprockets }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 22,
              height: 30,
              borderRadius: 4,
              border: "2px solid #333",
              backgroundColor: "#1a1a1a",
            }}
          />
        ))}
      </div>

      {/* Sprocket holes — right edge */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 44,
          backgroundColor: "#000000",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-evenly",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        {Array.from({ length: numSprockets }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 22,
              height: 30,
              borderRadius: 4,
              border: "2px solid #333",
              backgroundColor: "#1a1a1a",
            }}
          />
        ))}
      </div>

      {/* Caption box */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 44,
          right: 44,
          background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
          padding: "80px 120px 60px",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
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

      {/* Timestamp in top-right corner */}
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 60,
          fontFamily: "Courier New, monospace",
          fontSize: 22,
          color: "#ddcc88",
          letterSpacing: "2px",
          textShadow: "0 0 8px #ddcc8888",
          zIndex: 20,
        }}
      >
        {timestamp}
      </div>

      {/* Border frame */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: "12px solid #000000",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />
    </AbsoluteFill>
  );
};
