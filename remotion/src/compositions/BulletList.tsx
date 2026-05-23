import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const BulletList: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = bullets ?? text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 5);

  const titleProgress = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [-30, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 120px",
      }}
    >
      {/* Section header bar */}
      <div
        style={{
          width: 100,
          height: 6,
          backgroundColor: brandColor,
          marginBottom: 40,
          opacity: titleOpacity,
        }}
      />

      {/* Bullet items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {items.map((item, index) => {
          const itemProgress = spring({
            frame: frame - index * 6,
            fps,
            config: { damping: 18, stiffness: 90 },
          });
          const opacity = interpolate(itemProgress, [0, 1], [0, 1]);
          const x = interpolate(itemProgress, [0, 1], [50, 0]);

          return (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 24,
                opacity,
                transform: `translateX(${x}px)`,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: brandColor,
                  flexShrink: 0,
                  marginTop: 14,
                }}
              />
              <p
                style={{
                  fontFamily: fontSecondary,
                  fontSize: 38,
                  color: "#ffffff",
                  lineHeight: 1.45,
                  margin: 0,
                }}
              >
                {item}
              </p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
