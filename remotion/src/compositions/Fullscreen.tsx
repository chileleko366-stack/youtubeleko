import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const Fullscreen: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 22, stiffness: 90 } });
  const exitFrame = durationInFrames - 15;
  const exit = interpolate(frame, [exitFrame, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = Math.min(enter, exit);
  const scale = interpolate(enter, [0, 1], [0.92, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 100px",
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: "center",
          maxWidth: 1400,
        }}
      >
        <p
          style={{
            fontFamily: fontPrimary,
            fontSize: 80,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1.1,
            margin: 0,
            textTransform: "uppercase",
            letterSpacing: "-2px",
          }}
        >
          {text}
        </p>
        <div
          style={{
            width: 120,
            height: 6,
            backgroundColor: brandColor,
            margin: "40px auto 0",
            borderRadius: 3,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
