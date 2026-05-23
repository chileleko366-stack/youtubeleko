import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const StatsBanner: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  statValue,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bannerProgress = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const statProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const bannerWidth = interpolate(bannerProgress, [0, 1], [0, 100]);
  const statScale = interpolate(statProgress, [0, 1], [0.5, 1]);
  const statOpacity = interpolate(statProgress, [0, 1], [0, 1]);

  // Extract the stat value from text if not provided
  const displayStat = statValue ?? text.match(/\b[\d,.%$£€]+\b/)?.[0] ?? "";

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
      }}
    >
      {/* Animated banner bar */}
      <div
        style={{
          width: `${bannerWidth}%`,
          height: 8,
          backgroundColor: brandColor,
          borderRadius: 4,
        }}
      />

      {/* Stat value */}
      {displayStat && (
        <div
          style={{
            fontFamily: fontPrimary,
            fontSize: 140,
            fontWeight: 900,
            color: brandColor,
            lineHeight: 1,
            opacity: statOpacity,
            transform: `scale(${statScale})`,
            textShadow: `0 0 60px ${brandColor}66`,
          }}
        >
          {displayStat}
        </div>
      )}

      {/* Context text */}
      <p
        style={{
          fontFamily: fontSecondary,
          fontSize: 40,
          color: "#ffffff",
          margin: 0,
          textAlign: "center",
          maxWidth: 1200,
          lineHeight: 1.4,
          opacity: interpolate(bannerProgress, [0.4, 1], [0, 1], {
            extrapolateLeft: "clamp",
          }),
          padding: "0 80px",
        }}
      >
        {text}
      </p>

      {/* Bottom bar */}
      <div
        style={{
          width: `${bannerWidth}%`,
          height: 8,
          backgroundColor: brandColor,
          borderRadius: 4,
          opacity: 0.4,
        }}
      />
    </AbsoluteFill>
  );
};
