import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";
import { Scanlines } from "../lib/scanlines";

export const DocumentScan: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const docSpring = spring({ frame, fps, config: { damping: 30, stiffness: 120 } });
  const docOpacity = interpolate(docSpring, [0, 0.1], [0, 1]);

  // CRT scanline sweeps down
  const scanY = interpolate(frame, [0, durationInFrames], [-60, 1140]);

  // Typewriter effect
  const totalChars = text.length;
  const typeProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 100, stiffness: 60 },
  });
  const visibleChars = Math.round(
    interpolate(typeProgress, [0, 1], [0, totalChars], { extrapolateRight: "clamp" })
  );

  // Redaction bars animate on one-by-one
  const redact1 = spring({ frame: frame - 20, fps, config: { damping: 20, stiffness: 80 } });
  const redact2 = spring({ frame: frame - 30, fps, config: { damping: 20, stiffness: 80 } });
  const redact1W = interpolate(redact1, [0, 1], [0, 100]);
  const redact2W = interpolate(redact2, [0, 1], [0, 70]);

  // CLASSIFIED stamp: rotates + scales in at the end
  const stampDelay = Math.max(0, durationInFrames - 40);
  const stampSpring = spring({
    frame: frame - stampDelay,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.6 },
  });
  const stampScale = interpolate(stampSpring, [0, 1], [2, 1]);
  const stampOpacity = interpolate(stampSpring, [0, 0.3], [0, 1]);
  const stampRotate = interpolate(stampSpring, [0, 1], [45, -12]);

  // Green CRT phosphor glow
  const crtFilter = `sepia(0.15) hue-rotate(90deg) saturate(1.4) brightness(0.95)`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 200px",
        filter: crtFilter,
      }}
    >
      {/* Document */}
      <div
        style={{
          opacity: docOpacity,
          width: "100%",
          maxWidth: 1000,
          background: "#0a1a0a",
          borderRadius: 4,
          padding: "60px 80px",
          position: "relative",
          boxShadow: "0 20px 80px rgba(0,0,0,0.9), 0 0 40px #00ff0022",
          border: "1px solid #00ff0033",
          overflow: "hidden",
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
            transform: `rotate(${stampRotate}deg) scale(${stampScale})`,
            opacity: stampOpacity,
            transformOrigin: "center center",
            textShadow: `0 0 20px ${brandColor}`,
            boxShadow: `0 0 12px ${brandColor}44`,
          }}
        >
          DECLASSIFIED
        </div>

        {/* Document header */}
        <div style={{ marginBottom: 30 }}>
          {["CASE FILE", "DATE: REDACTED", "CLASSIFICATION: TS/SCI"].map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: 16,
                color: "#44bb44",
                marginBottom: 6,
                fontFamily: "Courier New, monospace",
                textShadow: "0 0 8px #00ff0066",
              }}
            >
              {line}
            </div>
          ))}
        </div>

        <hr style={{ borderColor: "#00ff0033", marginBottom: 30 }} />

        {/* Typewriter text */}
        <p
          style={{
            fontFamily: "Courier New, monospace",
            fontSize: 26,
            color: "#88ff88",
            lineHeight: 1.7,
            margin: "0 0 30px 0",
            textShadow: "0 0 6px #00ff0088",
          }}
        >
          {text.substring(0, visibleChars)}
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: "1em",
              backgroundColor: "#00ff00",
              marginLeft: 2,
              opacity: frame % 20 < 10 ? 1 : 0,
              verticalAlign: "text-bottom",
            }}
          />
        </p>

        {/* Redaction bars */}
        <div
          style={{
            height: 32,
            width: `${redact1W}%`,
            backgroundColor: "#001a00",
            border: "1px solid #003300",
            marginBottom: 16,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            height: 20,
            width: `${redact2W}%`,
            backgroundColor: "#001a00",
            border: "1px solid #003300",
            borderRadius: 2,
          }}
        />

        {/* CRT scanline sweep */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: scanY,
            height: 60,
            background: "linear-gradient(180deg, transparent, rgba(0,255,0,0.06) 50%, transparent)",
            pointerEvents: "none",
          }}
        />
      </div>

      <Scanlines enabled opacity={0.06} />
    </AbsoluteFill>
  );
};
