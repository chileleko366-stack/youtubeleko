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
import { easeOutExpo } from "../lib/easing";

// Primary ellipse parameters
const CX = 960;
const CY = 520;
const RX = 380;
const RY = 140;
const TOTAL_CIRCUMFERENCE = Math.PI * (3 * (RX + RY) - Math.sqrt((3 * RX + RY) * (RX + 3 * RY)));

// Secondary ellipse (different angle for depth)
const RX2 = 260;
const RY2 = 90;
const TOTAL_CIRC2 = Math.PI * (3 * (RX2 + RY2) - Math.sqrt((3 * RX2 + RY2) * (RX2 + 3 * RY2)));

// Get point on ellipse at angle t (radians)
const ellipsePoint = (t: number, rx: number, ry: number) => ({
  x: CX + rx * Math.cos(t),
  y: CY + ry * Math.sin(t),
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

  // Orbit path draws in with easeOutExpo
  const rawPathProg = interpolate(frame, [0, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pathProgress = easeOutExpo(rawPathProg);
  const dashOffset = (1 - pathProgress) * TOTAL_CIRCUMFERENCE;

  // Second orbit draws slightly after
  const rawPath2Prog = interpolate(frame, [10, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const path2Progress = easeOutExpo(rawPath2Prog);
  const dashOffset2 = (1 - path2Progress) * TOTAL_CIRC2;

  // Central star appears
  const starSpring = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 10, stiffness: 120 },
  });
  const starScale = interpolate(starSpring, [0, 1], [0, 1]);

  // Orbiting body 1 travels around primary orbit
  const orbitProgress = interpolate(
    frame,
    [20, 90],
    [Math.PI * 0.5, Math.PI * 2.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const orbitPoint = ellipsePoint(orbitProgress, RX, RY);
  const orbitOpacity = interpolate(frame, [20, 32], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Trail ghost positions for orbiting body 1
  const trailOffsets = [2, 4, 6];
  const trailPoints = trailOffsets.map((offset) => {
    const tAngle = interpolate(
      Math.max(20, frame - offset),
      [20, 90],
      [Math.PI * 0.5, Math.PI * 2.5],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return ellipsePoint(tAngle, RX, RY);
  });

  // Orbiting body 2 on second orbit — different speed
  const orbit2Angle = interpolate(
    frame,
    [30, 90],
    [Math.PI * 1.2, Math.PI * 3.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const orbit2Point = ellipsePoint(orbit2Angle, RX2, RY2);
  const orbit2Opacity = interpolate(frame, [30, 44], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Label fades in with blur dissolve after orbit drawn
  const labelSpring = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1]);
  const labelY = interpolate(labelSpring, [0, 1], [20, 0]);
  const labelBlur = interpolate(labelSpring, [0, 1], [8, 0]);

  // Star glow pulse — deterministic
  const glowPulse = 0.5 + 0.5 * Math.abs(Math.sin((frame * Math.PI) / 30));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#00000a",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ParticleField background */}
      <ParticleField count={120} speedMultiplier={0.2} sizeRange={[0.3, 1.8]} />

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

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 30%, rgba(0,0,8,0.82) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* SVG layer */}
      <svg
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <filter id="orbitGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Orbit tilt shadow — primary */}
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX}
          ry={RY}
          fill="none"
          stroke="rgba(255,68,68,0.06)"
          strokeWidth={28}
        />

        {/* Secondary orbit path */}
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX2}
          ry={RY2}
          fill="none"
          stroke="rgba(100,160,255,0.3)"
          strokeWidth={1.5}
          strokeDasharray={TOTAL_CIRC2}
          strokeDashoffset={dashOffset2}
          strokeLinecap="round"
          opacity={0.6}
          transform={`rotate(-25, ${CX}, ${CY})`}
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
          filter="url(#orbitGlow)"
        />

        {/* Orbit glow halo */}
        <ellipse
          cx={CX}
          cy={CY}
          rx={RX}
          ry={RY}
          fill="none"
          stroke={brandColor}
          strokeWidth={10}
          strokeDasharray={TOTAL_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          opacity={0.08}
        />

        {/* Central star — pulsing glow circle */}
        <g
          transform={`translate(${CX}, ${CY}) scale(${starScale})`}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
        >
          <circle cx={0} cy={0} r={80} fill={`rgba(255,200,60,${glowPulse * 0.12})`} />
          <circle cx={0} cy={0} r={50} fill={`rgba(255,200,60,${glowPulse * 0.2})`} />
          <circle cx={0} cy={0} r={28} fill="#fff7cc" />
          <circle cx={0} cy={0} r={22} fill="#ffdd66" />
          <circle cx={0} cy={0} r={14} fill="#ffffff" />
        </g>

        {/* Trail for orbiting body 1 */}
        {trailPoints.map((pt, i) => (
          <circle
            key={`trail-${i}`}
            cx={pt.x}
            cy={pt.y}
            r={6 - i * 1.5}
            fill="#88ccff"
            opacity={(orbitOpacity * (0.4 - i * 0.1))}
          />
        ))}

        {/* Orbiting body 1 */}
        <g opacity={orbitOpacity}>
          <circle cx={orbitPoint.x} cy={orbitPoint.y} r={22} fill="rgba(100,180,255,0.2)" />
          <circle
            cx={orbitPoint.x}
            cy={orbitPoint.y}
            r={12}
            fill="#88ccff"
            filter="url(#orbitGlow)"
          />
          <circle cx={orbitPoint.x} cy={orbitPoint.y} r={6} fill="#cceeff" />
        </g>

        {/* Orbiting body 2 — smaller, different orbit angle */}
        <g opacity={orbit2Opacity} transform={`rotate(-25, ${CX}, ${CY})`}>
          <circle cx={orbit2Point.x} cy={orbit2Point.y} r={10} fill="rgba(200,150,255,0.25)" />
          <circle
            cx={orbit2Point.x}
            cy={orbit2Point.y}
            r={6}
            fill="#cc88ff"
            filter="url(#orbitGlow)"
          />
          <circle cx={orbit2Point.x} cy={orbit2Point.y} r={3} fill="#eeddff" />
        </g>
      </svg>

      {/* Text overlay — blur dissolve after orbit drawn */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
          filter: `blur(${labelBlur}px)`,
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
