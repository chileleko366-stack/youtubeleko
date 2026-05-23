import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const DocumentScan: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scanProgress = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 120 },
  });
  const textProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 24, stiffness: 90 },
  });

  const scanY = interpolate(scanProgress, [0, 1], [-1080, 540]);
  const docOpacity = interpolate(scanProgress, [0, 0.1], [0, 1]);
  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);

  // Redaction bar animation
  const redactWidth = interpolate(
    spring({ frame: frame - 20, fps, config: { damping: 20, stiffness: 80 } }),
    [0, 1],
    [0, 100]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 200px",
      }}
    >
      {/* Document background */}
      <div
        style={{
          opacity: docOpacity,
          width: "100%",
          maxWidth: 1000,
          background: "#f5f0e8",
          borderRadius: 4,
          padding: "60px 80px",
          position: "relative",
          boxShadow: "0 20px 80px rgba(0,0,0,0.8)",
          fontFamily: "Courier New, monospace",
        }}
      >
        {/* CLASSIFIED stamp */}
        <div
          style={{
            position: "absolute",
            top: 30,
            right: 40,
            border: `4px solid ${brandColor}`,
            color: brandColor,
            padding: "8px 20px",
            fontSize: 28,
            fontWeight: 900,
            fontFamily: fontPrimary,
            letterSpacing: "4px",
            transform: "rotate(-12deg)",
            opacity: 0.9,
          }}
        >
          DECLASSIFIED
        </div>

        {/* Document header lines */}
        <div style={{ marginBottom: 30 }}>
          {["CASE FILE", "DATE: REDACTED", "CLASSIFICATION: TS/SCI"].map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: 16,
                color: "#555",
                marginBottom: 6,
                fontFamily: "Courier New, monospace",
              }}
            >
              {line}
            </div>
          ))}
        </div>

        <hr style={{ borderColor: "#aaa", marginBottom: 30 }} />

        {/* Main text with typewriter effect */}
        <p
          style={{
            fontFamily: "Courier New, monospace",
            fontSize: 26,
            color: "#222",
            lineHeight: 1.7,
            margin: "0 0 30px 0",
            opacity: textOpacity,
          }}
        >
          {text}
        </p>

        {/* Redaction bar */}
        <div
          style={{
            height: 32,
            width: `${redactWidth}%`,
            backgroundColor: "#1a1a1a",
            marginBottom: 16,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            height: 20,
            width: `${redactWidth * 0.7}%`,
            backgroundColor: "#1a1a1a",
            borderRadius: 2,
          }}
        />
      </div>

      {/* Scan line overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
          transform: `translateY(${scanY}px)`,
          opacity: 0.8,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
