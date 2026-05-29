import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

export const SpaceStat: React.FC<CompositionProps> = ({
  text,
  statValue,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Number slam-in bounce
  const statSpring = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.8 },
  });
  const statScale = interpolate(statSpring, [0, 1], [2.2, 1]);
  const statOpacity = interpolate(statSpring, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Units fade (delayed)
  const unitsSpring = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const unitsOpacity = interpolate(unitsSpring, [0, 1], [0, 1]);

  // Context label slides up (delayed more)
  const labelSpring = spring({
    frame: Math.max(0, frame - 22),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1]);
  const labelY = interpolate(labelSpring, [0, 1], [30, 0]);

  // Red glow pulse
  const glowPulse =
    0.6 + 0.4 * Math.abs(Math.sin((frame * Math.PI) / 35));

  // Parse value and unit from statValue (e.g. "4.6 BILLION YEARS" → value + unit)
  const parts = (statValue ?? "N/A").split(" ");
  const mainNumber = parts[0] ?? statValue ?? "N/A";
  const unitText = parts.slice(1).join(" ");

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Nebula background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 70% 70% at 50% 50%, rgba(80,0,120,0.35) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 20% 80%, rgba(0,20,80,0.4) 0%, transparent 60%),
            radial-gradient(ellipse 40% 50% at 80% 20%, rgba(20,0,60,0.3) 0%, transparent 60%)
          `,
        }}
      />

      {/* Subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,68,68,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,68,68,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          padding: "0 100px",
        }}
      >
        {/* Main stat number */}
        <div
          style={{
            fontFamily: fontPrimary,
            fontSize: 200,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 0.9,
            opacity: statOpacity,
            transform: `scale(${statScale})`,
            textShadow: `
              0 0 40px rgba(255,68,68,${glowPulse * 0.8}),
              0 0 80px rgba(255,68,68,${glowPulse * 0.5}),
              0 0 160px rgba(255,68,68,${glowPulse * 0.2})
            `,
            letterSpacing: "-4px",
          }}
        >
          {mainNumber}
        </div>

        {/* Units */}
        {unitText && (
          <div
            style={{
              fontFamily: fontPrimary,
              fontSize: 52,
              color: brandColor,
              letterSpacing: "6px",
              textTransform: "uppercase",
              opacity: unitsOpacity,
              marginTop: 8,
            }}
          >
            {unitText}
          </div>
        )}

        {/* Red accent line */}
        <div
          style={{
            width: 120,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
            margin: "32px auto",
            opacity: unitsOpacity,
            boxShadow: `0 0 12px ${brandColor}`,
          }}
        />

        {/* Context label */}
        <div
          style={{
            fontFamily: fontSecondary,
            fontSize: 32,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "3px",
            textTransform: "uppercase",
            opacity: labelOpacity,
            transform: `translateY(${labelY}px)`,
            maxWidth: 900,
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
