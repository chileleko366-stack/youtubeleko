import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const Timeline: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = bullets ?? text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 4);

  const lineProgress = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const lineHeight = interpolate(lineProgress, [0, 1], [0, 100]);

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
      <div style={{ width: "100%", position: "relative" }}>
        {/* Vertical timeline line */}
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 0,
            width: 4,
            height: `${lineHeight}%`,
            backgroundColor: brandColor,
            borderRadius: 2,
          }}
        />

        {/* Timeline items */}
        <div style={{ marginLeft: 80, display: "flex", flexDirection: "column", gap: 40 }}>
          {items.map((item, index) => {
            const itemProgress = spring({
              frame: frame - index * 8,
              fps,
              config: { damping: 18, stiffness: 90 },
            });
            const opacity = interpolate(itemProgress, [0, 1], [0, 1]);
            const x = interpolate(itemProgress, [0, 1], [40, 0]);

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
                {/* Dot */}
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    backgroundColor: brandColor,
                    flexShrink: 0,
                    marginTop: 8,
                    marginLeft: -68,
                    boxShadow: `0 0 16px ${brandColor}`,
                  }}
                />
                <p
                  style={{
                    fontFamily: fontSecondary,
                    fontSize: 36,
                    color: "#ffffff",
                    lineHeight: 1.4,
                    margin: 0,
                  }}
                >
                  {item}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
