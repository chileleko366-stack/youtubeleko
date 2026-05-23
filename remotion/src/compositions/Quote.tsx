import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const Quote: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  quoteText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 18, stiffness: 70 } });
  const quoteMarkProgress = spring({
    frame: frame - 5,
    fps,
    config: { damping: 25, stiffness: 60 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [30, 0]);
  const quoteMarkOpacity = interpolate(quoteMarkProgress, [0, 1], [0, 1]);
  const quoteMarkScale = interpolate(quoteMarkProgress, [0, 1], [2, 1]);

  const displayText = quoteText ?? text;

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 140px",
      }}
    >
      <div style={{ position: "relative", maxWidth: 1300, width: "100%" }}>
        {/* Opening quote mark */}
        <div
          style={{
            fontFamily: fontPrimary,
            fontSize: 200,
            color: brandColor,
            lineHeight: 0.6,
            marginBottom: 20,
            opacity: quoteMarkOpacity,
            transform: `scale(${quoteMarkScale})`,
            transformOrigin: "left top",
          }}
        >
          "
        </div>

        {/* Quote text */}
        <p
          style={{
            fontFamily: fontSecondary,
            fontSize: 52,
            fontStyle: "italic",
            color: "#ffffff",
            lineHeight: 1.5,
            margin: "0 0 40px",
            opacity,
            transform: `translateY(${translateY}px)`,
          }}
        >
          {displayText}
        </p>

        {/* Closing accent line */}
        <div
          style={{
            width: 200,
            height: 4,
            backgroundColor: brandColor,
            marginLeft: "auto",
            opacity,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
