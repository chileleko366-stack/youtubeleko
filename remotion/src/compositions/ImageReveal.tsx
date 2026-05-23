import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const ImageReveal: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const revealProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 60 },
  });
  const textProgress = spring({
    frame: frame - 18,
    fps,
    config: { damping: 22, stiffness: 100 },
  });

  const clipWidth = interpolate(revealProgress, [0, 1], [0, 100]);
  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);
  const textY = interpolate(textProgress, [0, 1], [30, 0]);

  // Vignette fade out near end
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* Simulated image area with gradient */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${clipWidth}%`,
          height: "100%",
          background: `linear-gradient(135deg, ${brandColor}22 0%, ${brandColor}44 50%, #000000 100%)`,
          overflow: "hidden",
          opacity: fadeOut,
        }}
      >
        {/* Geometric accent */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            right: "5%",
            width: 200,
            height: 200,
            border: `3px solid ${brandColor}`,
            borderRadius: "50%",
            opacity: 0.3,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "15%",
            left: "8%",
            width: 120,
            height: 120,
            backgroundColor: `${brandColor}33`,
            transform: "rotate(45deg)",
          }}
        />
      </div>

      {/* Text overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 100,
          right: 100,
          opacity: textOpacity * fadeOut,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            height: 4,
            width: 80,
            backgroundColor: brandColor,
            marginBottom: 24,
            borderRadius: 2,
          }}
        />
        <p
          style={{
            fontFamily: fontPrimary,
            fontSize: 52,
            fontWeight: 900,
            color: "#ffffff",
            margin: 0,
            lineHeight: 1.2,
            textShadow: "0 2px 20px rgba(0,0,0,0.8)",
          }}
        >
          {text}
        </p>
      </div>
    </AbsoluteFill>
  );
};
