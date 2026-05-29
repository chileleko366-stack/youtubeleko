import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

const DATA_POINTS = [
  { cx: 480, cy: 400, r: 90, label: "Milky Way", sublabel: "100,000 LY", color: "#6688ff", delay: 4 },
  { cx: 820, cy: 580, r: 40, label: "Andromeda", sublabel: "220,000 LY", color: "#aa66ff", delay: 10 },
  { cx: 1100, cy: 320, r: 130, label: "Triangulum", sublabel: "60,000 LY", color: "#4499cc", delay: 16 },
  { cx: 1380, cy: 500, r: 55, label: "Pegasus Dwarf", sublabel: "2,700 LY", color: "#ff8866", delay: 22 },
  { cx: 700, cy: 250, r: 20, label: "Canis Major", sublabel: "25,000 LY", color: "#ffcc44", delay: 28 },
  { cx: 1200, cy: 650, r: 70, label: "NGC 55", sublabel: "70,000 LY", color: "#55ccaa", delay: 34 },
];

const BG_STARS = Array.from({ length: 140 }, (_, i) => ({
  id: i,
  x: Math.random() * 1920,
  y: Math.random() * 1080,
  r: Math.random() * 1.5 + 0.3,
  op: Math.random() * 0.5 + 0.1,
  tw: Math.random() * 60,
}));

export const GalaxyDataViz: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 85 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [-20, 0]);

  return (
    <AbsoluteFill
      style={{ backgroundColor, overflow: "hidden" }}
    >
      {/* SVG layer */}
      <svg
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {/* Background stars */}
        {BG_STARS.map((s) => {
          const tw =
            0.3 +
            0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / 55));
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

        {/* Nebula gradients */}
        <defs>
          <radialGradient id="nebula1" cx="30%" cy="40%">
            <stop offset="0%" stopColor="rgba(60,0,120,0.35)" />
            <stop offset="100%" stopColor="rgba(0,0,8,0)" />
          </radialGradient>
          <radialGradient id="nebula2" cx="70%" cy="60%">
            <stop offset="0%" stopColor="rgba(0,20,80,0.3)" />
            <stop offset="100%" stopColor="rgba(0,0,8,0)" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x={0} y={0} width={1920} height={1080} fill="url(#nebula1)" />
        <rect x={0} y={0} width={1920} height={1080} fill="url(#nebula2)" />

        {/* Connecting lines between data points (subtle) */}
        {DATA_POINTS.map((dp, i) =>
          DATA_POINTS.slice(i + 1, i + 3).map((dp2, j) => {
            const lineDelay = Math.max(dp.delay, dp2.delay) + 4;
            const lProg = interpolate(frame, [lineDelay, lineDelay + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <line
                key={`${i}-${j}`}
                x1={dp.cx}
                y1={dp.cy}
                x2={dp2.cx}
                y2={dp2.cy}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={1}
                opacity={lProg}
                strokeDasharray="4 8"
              />
            );
          })
        )}

        {/* Data circles */}
        {DATA_POINTS.map((dp, i) => {
          const dSpring = spring({
            frame: Math.max(0, frame - dp.delay),
            fps,
            config: { damping: 10, stiffness: 140 },
          });
          const dScale = interpolate(dSpring, [0, 1], [0, 1]);
          const dOpacity = interpolate(dSpring, [0, 0.4], [0, 1], {
            extrapolateRight: "clamp",
          });
          const pulse = 1 + 0.06 * Math.abs(Math.sin((frame * Math.PI) / 35 + i));

          return (
            <g key={i} opacity={dOpacity}>
              {/* Outer glow ring */}
              <circle
                cx={dp.cx}
                cy={dp.cy}
                r={dp.r * dScale * 1.5}
                fill="none"
                stroke={dp.color}
                strokeWidth={1.5}
                opacity={0.25}
              />
              {/* Pulse ring */}
              <circle
                cx={dp.cx}
                cy={dp.cy}
                r={dp.r * dScale * pulse}
                fill="none"
                stroke={dp.color}
                strokeWidth={1}
                opacity={0.15}
              />
              {/* Main body */}
              <circle
                cx={dp.cx}
                cy={dp.cy}
                r={dp.r * dScale}
                fill={dp.color}
                fillOpacity={0.18}
                stroke={dp.color}
                strokeWidth={2}
                filter="url(#glow)"
              />
              {/* Center dot */}
              <circle
                cx={dp.cx}
                cy={dp.cy}
                r={Math.min(dp.r * 0.15, 8) * dScale}
                fill={dp.color}
                opacity={0.9}
              />
            </g>
          );
        })}
      </svg>

      {/* Labels (HTML for font rendering) */}
      {DATA_POINTS.map((dp, i) => {
        const lDelay = dp.delay + 6;
        const lSpring = spring({
          frame: Math.max(0, frame - lDelay),
          fps,
          config: { damping: 20, stiffness: 100 },
        });
        const lOpacity = interpolate(lSpring, [0, 1], [0, 1]);
        const lY = interpolate(lSpring, [0, 1], [10, 0]);
        const pct_x = (dp.cx / 1920) * 100;
        const pct_y = ((dp.cy + dp.r + 18) / 1080) * 100;

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
                fontSize: 20,
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
                fontSize: 15,
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
