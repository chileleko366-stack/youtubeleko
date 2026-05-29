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
import { easeOutElastic } from "../lib/easing";

const DATA_POINTS = [
  { cx: 960, cy: 540, r: 110, label: "Milky Way", sublabel: "100,000 LY", color: "#6688ff", delay: 0, isCenter: true },
  { cx: 620, cy: 420, r: 45, label: "Andromeda", sublabel: "220,000 LY", color: "#aa66ff", delay: 10 },
  { cx: 1180, cy: 330, r: 70, label: "Triangulum", sublabel: "60,000 LY", color: "#4499cc", delay: 18 },
  { cx: 1360, cy: 580, r: 40, label: "Pegasus Dwarf", sublabel: "2,700 LY", color: "#ff8866", delay: 26 },
  { cx: 700, cy: 680, r: 28, label: "Canis Major", sublabel: "25,000 LY", color: "#ffcc44", delay: 34 },
  { cx: 1160, cy: 700, r: 55, label: "NGC 55", sublabel: "70,000 LY", color: "#55ccaa", delay: 42 },
];

// Deterministic background stars
const BG_STARS = Array.from({ length: 200 }, (_, i) => ({
  id: i,
  x: random(`gdv-x-${i}`) * 1920,
  y: random(`gdv-y-${i}`) * 1080,
  r: random(`gdv-r-${i}`) * 1.5 + 0.3,
  op: random(`gdv-o-${i}`) * 0.5 + 0.1,
  tw: random(`gdv-t-${i}`) * 60,
  speed: 30 + random(`gdv-sp-${i}`) * 40,
}));

// Connection pairs between nearby nodes
const CONNECTIONS = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 4], [2, 3], [2, 5]];

export const GalaxyDataViz: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slowly counter-clockwise rotating background via transform on SVG
  const bgRotation = interpolate(frame, [0, 300], [0, -8], {
    extrapolateRight: "clamp",
  });

  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 85 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [-20, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#00000c", overflow: "hidden" }}>
      {/* SVG layer — rotating star map feel */}
      <svg
        viewBox="0 0 1920 1080"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          transform: `rotate(${bgRotation}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        {/* Background stars — rotating with SVG */}
        {BG_STARS.map((s) => {
          const tw =
            0.3 + 0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / s.speed));
          return (
            <circle
              key={s.id}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#ffffff"
              opacity={s.op * tw}
            />
          );
        })}
      </svg>

      {/* Static SVG for data elements (no rotation) */}
      <svg
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <radialGradient id="nebula1" cx="30%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(60,0,120,0.35)" />
            <stop offset="100%" stopColor="rgba(0,0,8,0)" />
          </radialGradient>
          <radialGradient id="nebula2" cx="70%" cy="60%" r="60%">
            <stop offset="0%" stopColor="rgba(0,20,80,0.3)" />
            <stop offset="100%" stopColor="rgba(0,0,8,0)" />
          </radialGradient>
          <filter id="nodeGlow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x={0} y={0} width={1920} height={1080} fill="url(#nebula1)" />
        <rect x={0} y={0} width={1920} height={1080} fill="url(#nebula2)" />

        {/* Connecting lines between nodes — strokeDashoffset draw-in */}
        {CONNECTIONS.map(([a, b], ci) => {
          const dpA = DATA_POINTS[a];
          const dpB = DATA_POINTS[b];
          const lineDelay = Math.max(dpA.delay, dpB.delay) + 6;
          const lineProg = interpolate(frame, [lineDelay, lineDelay + 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const dx = dpB.cx - dpA.cx;
          const dy = dpB.cy - dpA.cy;
          const lineLen = Math.sqrt(dx * dx + dy * dy);
          return (
            <line
              key={ci}
              x1={dpA.cx}
              y1={dpA.cy}
              x2={dpB.cx}
              y2={dpB.cy}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1.5}
              opacity={lineProg}
              strokeDasharray={`${lineLen}`}
              strokeDashoffset={lineLen * (1 - lineProg)}
            />
          );
        })}

        {/* Data node circles — easeOutElastic scale in */}
        {DATA_POINTS.map((dp, i) => {
          const rawProg = interpolate(
            frame,
            [dp.delay, dp.delay + 16],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const dScale = easeOutElastic(rawProg);
          const dOpacity = interpolate(rawProg, [0, 0.2], [0, 1], {
            extrapolateRight: "clamp",
          });
          const pulse = 1 + 0.06 * Math.abs(Math.sin((frame * Math.PI) / 35 + i));
          const isCenter = (dp as any).isCenter;

          return (
            <g key={i} opacity={dOpacity}>
              {/* Outer pulsing glow rings — 3 rings at different opacities */}
              <circle
                cx={dp.cx}
                cy={dp.cy}
                r={dp.r * dScale * 2.2}
                fill="none"
                stroke={dp.color}
                strokeWidth={1}
                opacity={0.12}
              />
              <circle
                cx={dp.cx}
                cy={dp.cy}
                r={dp.r * dScale * 1.7 * pulse}
                fill="none"
                stroke={dp.color}
                strokeWidth={1.5}
                opacity={0.2}
              />
              <circle
                cx={dp.cx}
                cy={dp.cy}
                r={dp.r * dScale * 1.35}
                fill="none"
                stroke={dp.color}
                strokeWidth={2}
                opacity={0.35}
              />
              {/* Main body */}
              <circle
                cx={dp.cx}
                cy={dp.cy}
                r={dp.r * dScale}
                fill={dp.color}
                fillOpacity={isCenter ? 0.3 : 0.18}
                stroke={dp.color}
                strokeWidth={isCenter ? 3 : 2}
                filter="url(#nodeGlow)"
              />
              {/* Center dot */}
              <circle
                cx={dp.cx}
                cy={dp.cy}
                r={Math.min(dp.r * 0.18, isCenter ? 12 : 8) * dScale}
                fill={dp.color}
                opacity={isCenter ? 1 : 0.9}
              />
              {/* Extra bright center for galaxy center node */}
              {isCenter && (
                <circle
                  cx={dp.cx}
                  cy={dp.cy}
                  r={6 * dScale}
                  fill="#ffffff"
                  opacity={0.9}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Labels (HTML for font rendering) */}
      {DATA_POINTS.map((dp, i) => {
        const lDelay = dp.delay + 8;
        const lSpring = spring({
          frame: Math.max(0, frame - lDelay),
          fps,
          config: { damping: 20, stiffness: 100 },
        });
        const lOpacity = interpolate(lSpring, [0, 1], [0, 1]);
        const lY = interpolate(lSpring, [0, 1], [10, 0]);
        const pct_x = (dp.cx / 1920) * 100;
        const pct_y = ((dp.cy + dp.r + 20) / 1080) * 100;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${pct_x}%`,
              top: `${pct_y}%`,
              transform: `translate(-50%, 0) translateY(${lY}px)`,
              textAlign: "center",
              opacity: lOpacity,
            }}
          >
            <div
              style={{
                fontFamily: fontPrimary,
                fontSize: 18,
                color: dp.color,
                letterSpacing: "2px",
                textTransform: "uppercase",
                textShadow: `0 0 12px ${dp.color}`,
              }}
            >
              {dp.label}
            </div>
            <div
              style={{
                fontFamily: fontSecondary,
                fontSize: 14,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "2px",
              }}
            >
              {dp.sublabel}
            </div>
          </div>
        );
      })}

      {/* Title overlay */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <h1
          style={{
            fontFamily: fontPrimary,
            fontSize: 52,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "6px",
            margin: 0,
            textShadow: `0 0 30px rgba(255,68,68,0.3)`,
          }}
        >
          {text}
        </h1>
        <div
          style={{
            width: 80,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
            margin: "12px auto 0",
            boxShadow: `0 0 12px ${brandColor}`,
          }}
        />
      </div>

      {/* Bottom label */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
        }}
      >
        <div
          style={{
            fontFamily: fontSecondary,
            fontSize: 16,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "5px",
            textTransform: "uppercase",
          }}
        >
          LOCAL GROUP GALAXY CHART — RED SPACE FACTS
        </div>
      </div>
    </AbsoluteFill>
  );
};
