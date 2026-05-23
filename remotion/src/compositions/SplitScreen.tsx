import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const SplitScreen: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftProgress = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const rightProgress = spring({
    frame: frame - 8,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const leftX = interpolate(leftProgress, [0, 1], [-960, 0]);
  const rightX = interpolate(rightProgress, [0, 1], [960, 0]);

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const leftText = sentences[0] ?? text;
  const rightText = sentences[1] ?? "";

  return (
    <AbsoluteFill style={{ backgroundColor, flexDirection: "row" }}>
      {/* Left panel */}
      <div
        style={{
          flex: 1,
          backgroundColor: brandColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
          transform: `translateX(${leftX}px)`,
        }}
      >
        <p
          style={{
            fontFamily: fontPrimary,
            fontSize: 52,
            fontWeight: 900,
            color: "#000000",
            lineHeight: 1.2,
            margin: 0,
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          {leftText}
        </p>
      </div>

      {/* Divider */}
      <div style={{ width: 6, backgroundColor: "#000000" }} />

      {/* Right panel */}
      <div
        style={{
          flex: 1,
          backgroundColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
          transform: `translateX(${rightX}px)`,
        }}
      >
        <p
          style={{
            fontFamily: fontSecondary,
            fontSize: 40,
            color: "#ffffff",
            lineHeight: 1.4,
            margin: 0,
            textAlign: "center",
          }}
        >
          {rightText || leftText}
        </p>
      </div>
    </AbsoluteFill>
  );
};
