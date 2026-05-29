import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  random,
} from "remotion";
import type { CompositionProps } from "../Root";
import { ParticleField } from "../lib/particles";
import { GlowText } from "../lib/glowText";
import { easeOutExpo } from "../lib/easing";

const RING_CIRCUMFERENCE = 2 * Math.PI * 180; // r=180

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

  const parts = (statValue ?? "0").split(" ");
  const rawNumber = parts[0] ?? "0";
  const unitText = parts.slice(1).join(" ");
  const parsedTarget = parseFloat(rawNumber.replace(/[^0-9.]/g, "")) || 0;
  const suffix = rawNumber.replace(/[0-9.]/g, "");

  // Count up from 0 to target over 60 frames
  const countProgress = interpolate(frame, [0, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const countValue = Math.floor(parsedTarget * easeOutExpo(countProgress));

  // Slam spring at frame 60 (scale bounce)
  const slamSpring = spring({
    frame: Math.max(0, frame - 60),
    fps,
    config: { damping: 6, stiffness: 400, mass: 0.5 },
  });
  const slamScale = frame >= 60
    ? interpolate(slamSpring, [0, 0.4, 1], [1.0, 1.08, 1.0])
    : 1;

  // SVG ring fills as count progresses
  const ringDashOffset = RING_CIRCUMFERENCE * (1 - countProgress);

  // Units fade in after number finishes
  const unitsSpring = spring({
    frame: Math.max(0, frame - 65),
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const unitsOpacity = interpolate(unitsSpring, [0, 1], [0, 1]);
  const unitsY = interpolate(unitsSpring, [0, 1], [20, 0]);

  // Pulsing glow ring at the end
  const glowPulse = 0.5 + 0.5 * Math.abs(Math.sin((frame * Math.PI) / 30));
  const outerRingOpacity = interpolate(frame, [65, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) * (0.3 + 0.4 * glowPulse);

  // Background gradient breath — deterministic
  const bgBreath = 0.4 + 0.2 * Math.sin((frame * Math.PI) / 70);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#00000e",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Animated deep black → dark purple nebula gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 80% at 50% 50%, rgba(70,0,110,${bgBreath * 0.5}) 0%, rgba(0,0,30,0.4) 55%, transparent 100%),
            radial-gradient(ellipse 45% 45% at 20% 80%, rgba(0,15,70,0.35) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 80% 20%, rgba(40,0,60,0.3) 0%, transparent 55%)
          `,
          pointerEvents: "none",
        }}
      />

      <ParticleField count={150} speedMultiplier={0.25} sizeRange={[0.3, 1.8]} />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 35%, rgba(0,0,10,0.85) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* SVG ring + number */}
        <div style={{ position: "relative", width: 420, height: 420 }}>
          {/* Pulsing outer glow ring */}
          <svg
            viewBox="0 0 420 420"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          >
            <circle
              cx={210}
              cy={210}
              r={200}
              fill="none"
              stroke={brandColor}
              strokeWidth={3}
              opacity={outerRingOpacity}
              style={{ filter: `drop-shadow(0 0 12px ${brandColor})` }}
            />
          </svg>

          {/* Filling progress ring */}
          <svg
            viewBox="0 0 420 420"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              transform: "rotate(-90deg)",
            }}
          >
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={brandColor} />
                <stop offset="100%" stopColor="rgba(255,100,50,0.5)" />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle
              cx={210}
              cy={210}
              r={180}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={6}
            />
            {/* Fill */}
            <circle
              cx={210}
              cy={210}
              r={180}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth={6}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringDashOffset}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 8px ${brandColor})` }}
            />
          </svg>

          {/* Number in center */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${slamScale})`,
            }}
          >
            <GlowText
              text={`${countValue}${suffix}`}
              fontFamily={fontPrimary}
              fontSize={160}
              fontWeight={900}
              color="#ffffff"
              glowColor="rgba(255,68,68,0.85)"
              glowRadius={80}
              letterSpacing="-4px"
            />
          </div>
        </div>

        {/* Units text */}
        {unitText && (
          <div
            style={{
              fontFamily: fontPrimary,
              fontSize: 48,
              color: brandColor,
              letterSpacing: "6px",
              textTransform: "uppercase",
              opacity: unitsOpacity,
              transform: `translateY(${unitsY}px)`,
              textShadow: `0 0 20px ${brandColor}, 0 0 40px rgba(255,68,68,0.4)`,
              marginTop: -16,
            }}
          >
            {unitText}
          </div>
        )}

        {/* Divider line */}
        <div
          style={{
            width: 100,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
            margin: "28px auto",
            opacity: unitsOpacity,
            boxShadow: `0 0 12px ${brandColor}`,
            borderRadius: 2,
          }}
        />

        {/* Context label */}
        <div
          style={{
            fontFamily: fontSecondary,
            fontSize: 28,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "3px",
            textTransform: "uppercase",
            opacity: unitsOpacity,
            maxWidth: 900,
            textAlign: "center",
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
