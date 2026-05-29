import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

// Ellipse parameters
const CX = 960;
const CY = 540;
const RX = 380;
const RY = 140;
const TOTAL_CIRCUMFERENCE = Math.PI * (3 * (RX + RY) - Math.sqrt((3 * RX + RY) * (RX + 3 * RY)));

// Get point on ellipse at angle t (radians)
const ellipsePoint = (t: number) => ({
  x: CX + RX * Math.cos(t),
  y: CY + RY * Math.sin(t),
});

export const OrbitPath: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Orbit path draws in
  const pathSpring = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 60 },
  });
  const pathProgress = interpolate(pathSpring, [0, 1], [1, 0]); // dashoffset: 1=hidden, 0=shown
  const dashOffset = pathProgress * TOTAL_CIRCUMFERENCE;

  // Central star appears
  const starSpring = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 10, stiffness: 120 },
  });
  const starScale = interpolate(starSpring, [0, 1], [0, 1]);

  // Orbiting body travels around
  const orbitProgress = interpolate(
    frame,
    [20, 90],
    [Math.PI * 0.5, Math.PI * 2.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const orbitPoint = ellipsePoint(orbitProgress);
  const orbitOpacity = interpolate(frame, [20, 32], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Label fades in
  const labelSpring = spring({
    frame: Math.max(0, frame - 35),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1]);
  const labelY = interpolate(labelSpring, [0, 1], [20, 0]);

  // Star glow pulse
  const glowPulse = 0.5 + 0.5 * Math.abs(Math.sin((frame * Math.PI) / 30));

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
      {/* Background nebula */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 60% 60% at 50% 50%, rgba(40,0,70,0.5) 0%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 80% 30%, rgba(0,20,80,0.3) 0%, transparent 60%)
          `,
        }}
      />

      {/* SVG layer */}
      <svg
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {/* Orbit tilt shadow */}
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX}
          ry={RY}
          fill="none"
          stroke="rgba(255,68,68,0.06)"
          strokeWidth={28}
        />

        {/* Main orbit ellipse with dash animation */}
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX}
          ry={RY}
          fill="none"
          stroke={brandColor}
          strokeWidth={2.5}
          strokeDasharray={TOTAL_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          opacity={0.85}
          style={{ filter: `drop-shadow(0 0 8px ${brandColor})` }}
        />

        {/* Orbit glow */}
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX}
          ry={RY}
          fill="none"
          stroke={brandColor}
          strokeWidth={8}
          strokeDasharray={TOTAL_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          opacity={0.12}
        />

        {/* Central star */}
        <g
          transform={`translate(${CX}, ${CY}) scale(${starScale})`}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        >
          {/* Glow layers */}
          <circle
            cx={0}
            cy={0}
            r={70}
            fill={`rgba(255,200,60,${glowPulse * 0.15})`}
          />
          <circle
            cx={0}
            cy={0}
            r={40}
            fill={`rgba(255,200,60,${glowPulse * 0.25})`}
          />
          <circle cx={0} cy={0} r={22} fill="#fff7cc" />
          <circle cx={0} cy={0} r={18} fill="#ffdd66" />
          <circle cx={0} cy={0} r={12} fill="#ffffff" />
        </g>

        {/* Orbiting body */}
        <g opacity={orbitOpacity}>
          <circle
            cx={orbitPoint.x}
            cy={orbitPoint.y}
            r={18}
            fill="rgba(100,180,255,0.2)"
          />
          <circle
            cx={orbitPoint.x}
            cy={orbitPoint.y}
            r={10}
            fill="#88ccff"
            style={{ filter: "drop-shadow(0 0 8px #88ccff)" }}
          />
          <circle cx={orbitPoint.x} cy={orbitPoint.y} r={5} fill="#cceeff" />
        </g>
      </svg>

      {/* Text overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
        }}
      >
        <div
          style={{
            width: 60,
            height: 3,
            backgroundColor: brandColor,
            margin: "0 auto 20px",
            boxShadow: `0 0 10px ${brandColor}`,
          }}
        />
        <h2
          style={{
            fontFamily: fontPrimary,
            fontSize: 64,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "3px",
            margin: "0 0 12px",
            textShadow: "0 0 30px rgba(255,255,255,0.25)",
          }}
        >
          {text}
        </h2>
        <p
          style={{
            fontFamily: fontSecondary,
            fontSize: 22,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "5px",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          ORBITAL MECHANICS
        </p>
      </div>
    </AbsoluteFill>
  );
};
