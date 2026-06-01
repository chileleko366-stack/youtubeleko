import React from "react";
import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";
import { GradientBg } from "../lib/gradientBg";
import { LightLeak } from "../lib/lightLeak";
import { easeOutExpo } from "../lib/easing";

interface DataPoint {
  x: number;
  y: number;
  label: string;
  value: number;
}

export const DataViz: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 100 },
  });

  const rawItems = bullets && bullets.length > 0 ? bullets : text.split(/[,;]/).map((s) => s.trim());
  const dataPoints: DataPoint[] = rawItems.slice(0, 8).map((item, i) => {
    const match = item.match(/(\d+(?:\.\d+)?)/);
    const value = match ? parseFloat(match[1]) : (i + 1) * 12;
    const label = item.replace(/^\d+(?:\.\d+)?%?\s*[-:]?\s*/, "").trim() || item;

    // Random position using deterministic random()
    const x = 200 + random(`dp-x-${i}`) * 1500;
    const y = 150 + random(`dp-y-${i}`) * 780;

    return { x, y, label: label.substring(0, 20), value };
  });

  const maxValue = Math.max(...dataPoints.map((d) => d.value), 1);

  const titleT = Math.min(titleProgress, 1);
  const titleOpacity = easeOutExpo(titleT);
  const titleY = interpolate(easeOutExpo(titleT), [0, 1], [-20, 0]);

  // Dot grid background
  const gridDots = Array.from({ length: 15 * 9 }).map((_, i) => ({
    x: (i % 15) * (1920 / 14),
    y: Math.floor(i / 15) * (1080 / 8),
  }));

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      <GradientBg
        colors={[backgroundColor, `${brandColor}0a`, backgroundColor]}
        angle={150}
        animate
      />

      {/* Dot grid */}
      <svg
        style={{ position: "absolute", inset: 0 }}
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
      >
        {gridDots.map((dot, i) => (
          <circle key={i} cx={dot.x} cy={dot.y} r={2} fill={`${brandColor}18`} />
        ))}
      </svg>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 120,
          right: 120,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            height: 4,
            width: 60,
            background: `linear-gradient(90deg, ${brandColor}, ${brandColor}44)`,
            marginBottom: 16,
            borderRadius: 2,
            boxShadow: `0 0 10px ${brandColor}88`,
          }}
        />
        <h1
          style={{
            fontFamily: fontPrimary,
            fontSize: 44,
            fontWeight: 900,
            color: "#ffffff",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          {text.length > 60 ? text.substring(0, 60) + "…" : text}
        </h1>
      </div>

      {/* SVG data viz */}
      <svg
        style={{ position: "absolute", inset: 0 }}
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
      >
        {/* Connecting lines between nearby points */}
        {dataPoints.map((pt, i) =>
          dataPoints.slice(i + 1).map((pt2, j) => {
            const dist = Math.hypot(pt2.x - pt.x, pt2.y - pt.y);
            if (dist > 500) return null;
            const lineDelay = (i + j) * 5 + 8;
            const lineSpring = spring({
              frame: frame - lineDelay,
              fps,
              config: { damping: 22, stiffness: 80 },
            });
            const totalLen = dist;
            const drawn = interpolate(lineSpring, [0, 1], [0, totalLen]);

            return (
              <line
                key={`line-${i}-${j}`}
                x1={pt.x}
                y1={pt.y}
                x2={pt2.x}
                y2={pt2.y}
                stroke={brandColor}
                strokeWidth={1.5}
                strokeOpacity={0.2}
                strokeDasharray={`${drawn} ${totalLen - drawn}`}
              />
            );
          })
        )}

        {/* Data point circles with glow rings */}
        {dataPoints.map((pt, i) => {
          const ptDelay = i * 5;
          const ptSpring = spring({
            frame: frame - ptDelay,
            fps,
            config: { damping: 14, stiffness: 180, mass: 0.5 },
          });
          const ptScale = interpolate(ptSpring, [0, 1], [0, 1]);
          const ptOpacity = interpolate(ptSpring, [0, 0.4], [0, 1]);

          const baseRadius = 12 + (pt.value / maxValue) * 28;

          // Pulsing glow ring
          const pulseRadius = baseRadius + interpolate(
            Math.sin(frame * 0.08 + i * 0.7),
            [-1, 1],
            [0, 12]
          );
          const pulseOpacity = interpolate(
            Math.sin(frame * 0.08 + i * 0.7),
            [-1, 1],
            [0.05, 0.25]
          );

          // From random direction: offset incoming
          const dirX = (random(`dp-dir-x-${i}`) - 0.5) * 200;
          const dirY = (random(`dp-dir-y-${i}`) - 0.5) * 200;
          const offsetX = interpolate(ptSpring, [0, 1], [dirX, 0]);
          const offsetY = interpolate(ptSpring, [0, 1], [dirY, 0]);

          // Label fade in after point
          const labelSpring = spring({
            frame: frame - ptDelay - 8,
            fps,
            config: { damping: 22, stiffness: 100 },
          });
          const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1]);

          return (
            <g
              key={i}
              opacity={ptOpacity}
              transform={`translate(${offsetX}, ${offsetY})`}
            >
              {/* Pulsing glow ring */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={pulseRadius * ptScale}
                fill="none"
                stroke={brandColor}
                strokeWidth={2}
                strokeOpacity={pulseOpacity}
              />
              {/* Main circle */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={baseRadius * ptScale}
                fill={`${brandColor}33`}
                stroke={brandColor}
                strokeWidth={2}
                style={{ filter: `drop-shadow(0 0 8px ${brandColor})` }}
              />

              {/* Label */}
              <foreignObject
                x={pt.x + baseRadius + 8}
                y={pt.y - 16}
                width={220}
                height={36}
                opacity={labelOpacity}
              >
                <div
                  style={{
                    fontFamily: fontSecondary,
                    fontSize: 20,
                    color: "#cccccc",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pt.label}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>

      <LightLeak opacity={0.05} />
    </AbsoluteFill>
  );
};
