import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const CelebrityCard: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardProgress = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const textProgress = spring({
    frame: frame - 12,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const cardY = interpolate(cardProgress, [0, 1], [200, 0]);
  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);
  const textX = interpolate(textProgress, [0, 1], [60, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: "flex",
        alignItems: "center",
        padding: "0 100px",
        gap: 60,
      }}
    >
      {/* Celebrity placeholder card */}
      <div
        style={{
          width: 400,
          height: 500,
          borderRadius: 12,
          backgroundColor: "#1a1a1a",
          border: `3px solid ${brandColor}`,
          flexShrink: 0,
          transform: `translateY(${cardY}px)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: `linear-gradient(135deg, #1a1a1a 0%, ${brandColor}33 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              backgroundColor: brandColor,
              opacity: 0.3,
            }}
          />
        </div>
      </div>

      {/* Text content */}
      <div
        style={{
          flex: 1,
          opacity: textOpacity,
          transform: `translateX(${textX}px)`,
        }}
      >
        <div
          style={{
            width: 80,
            height: 4,
            backgroundColor: brandColor,
            marginBottom: 24,
          }}
        />
        <p
          style={{
            fontFamily: fontPrimary,
            fontSize: 58,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1.2,
            margin: "0 0 24px",
            textTransform: "uppercase",
          }}
        >
          {text}
        </p>
        <p
          style={{
            fontFamily: fontSecondary,
            fontSize: 28,
            color: brandColor,
            margin: 0,
            letterSpacing: "4px",
            textTransform: "uppercase",
          }}
        >
          DOPAMINE LOOP
        </p>
      </div>
    </AbsoluteFill>
  );
};
