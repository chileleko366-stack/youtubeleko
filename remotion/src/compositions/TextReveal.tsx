import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const TextReveal: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [40, 0]);
  const lineWidth = interpolate(progress, [0, 0.6], [0, 100], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 120px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1400 }}>
        <div
          style={{
            height: 4,
            width: `${lineWidth}%`,
            backgroundColor: brandColor,
            marginBottom: 32,
            borderRadius: 2,
          }}
        />
        <p
          style={{
            fontFamily: fontPrimary,
            fontSize: 72,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1.15,
            margin: 0,
            opacity,
            transform: `translateY(${translateY}px)`,
            textTransform: "uppercase",
            letterSpacing: "-1px",
          }}
        >
          {text}
        </p>
        <div
          style={{
            height: 4,
            width: `${lineWidth}%`,
            backgroundColor: brandColor,
            marginTop: 32,
            borderRadius: 2,
            marginLeft: "auto",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
