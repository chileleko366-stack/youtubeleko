import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";
import { GradientBg } from "../lib/gradientBg";
import { LightLeak } from "../lib/lightLeak";
import { easeOutElastic } from "../lib/easing";

interface Node {
  x: number;
  y: number;
  label: string;
  radius: number;
}

export const BrainDiagram: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgProgress = spring({ frame, fps, config: { damping: 30, stiffness: 60 } });
  const titleProgress = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 100 } });

  const bgOpacity = interpolate(bgProgress, [0, 1], [0, 1]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [-25, 0]);

  const rawItems =
    bullets && bullets.length > 0
      ? bullets.slice(0, 6)
      : text.split(/[,.;]/).map((s) => s.trim()).filter(Boolean).slice(0, 6);

  const nodes: Node[] = rawItems.map((item, i) => {
    const angle = (i / rawItems.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 240;
    return {
      x: 960 + Math.cos(angle) * radius,
      y: 540 + Math.sin(angle) * radius,
      label: item.length > 22 ? item.substring(0, 22) + "…" : item,
      radius: 65,
    };
  });

  // Central node pulse
  const centralPulse = 1 + interpolate(Math.sin(frame * 0.08), [-1, 1], [0, 0.08]);

  // Signal dot travels along each connection
  // It travels from center to each node over ~30 frames, then loops
  const signalCycle = 60;

  return (
    <AbsoluteFill style={{ backgroundColor, opacity: bgOpacity }}>
      <GradientBg
        colors={[backgroundColor, `${brandColor}0d`, backgroundColor]}
        angle={130}
        animate
      />

      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 1920 1080"
      >
        {/* Connection lines with strokeDashoffset draw-in */}
        {nodes.map((node, i) => {
          const lineDelay = i * 6 + 4;
          const lineSpring = spring({
            frame: frame - lineDelay,
            fps,
            config: { damping: 20, stiffness: 60 },
          });
          const dx = node.x - 960;
          const dy = node.y - 540;
          const lineLen = Math.hypot(dx, dy);
          const drawn = interpolate(lineSpring, [0, 1], [0, lineLen]);
          const lineOpacity = interpolate(lineSpring, [0, 0.2], [0, 0.6]);

          // Signal dot traveling along the line
          const signalT = ((frame + i * (signalCycle / nodes.length)) % signalCycle) / signalCycle;
          const signalX = 960 + dx * signalT;
          const signalY = 540 + dy * signalT;
          const signalOpacity = lineSpring > 0.5 ? 0.9 : 0;

          return (
            <g key={`conn-${i}`}>
              {/* Animated line */}
              <line
                x1={960}
                y1={540}
                x2={node.x}
                y2={node.y}
                stroke={brandColor}
                strokeWidth={2}
                opacity={lineOpacity}
                strokeDasharray={`${drawn} ${lineLen - drawn}`}
                style={{ filter: `drop-shadow(0 0 4px ${brandColor})` }}
              />
              {/* Traveling signal dot */}
              <circle
                cx={signalX}
                cy={signalY}
                r={5}
                fill={brandColor}
                opacity={signalOpacity}
                style={{ filter: `drop-shadow(0 0 8px ${brandColor})` }}
              />
            </g>
          );
        })}

        {/* Satellite nodes — easeOutElastic scale-in */}
        {nodes.map((node, i) => {
          const nodeDelay = i * 6 + 10;
          const nodeSpring = spring({
            frame: frame - nodeDelay,
            fps,
            config: { damping: 8, stiffness: 240, mass: 0.4 },
          });
          const nodeScale = interpolate(
            easeOutElastic(Math.min(nodeSpring, 1)),
            [0, 1],
            [0, 1]
          );
          const nodeOpacity = interpolate(nodeSpring, [0, 0.3], [0, 1]);

          // Glow ring pulses sequentially
          const glowPulse = 1 + interpolate(
            Math.sin(frame * 0.1 + i * 1.2),
            [-1, 1],
            [0, 0.4]
          );
          const glowRingOpacity = interpolate(nodeSpring, [0, 1], [0, 0.4]);

          // Label fades in after node fires
          const labelSpring = spring({
            frame: frame - nodeDelay - 6,
            fps,
            config: { damping: 22, stiffness: 100 },
          });
          const labelOpacity = interpolate(labelSpring, [0, 1], [0, 1]);

          return (
            <g key={`node-${i}`} opacity={nodeOpacity}>
              {/* Outer glow ring */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius * nodeScale * glowPulse}
                fill="none"
                stroke={brandColor}
                strokeWidth={2}
                opacity={glowRingOpacity}
                style={{ filter: `drop-shadow(0 0 12px ${brandColor})` }}
              />
              {/* Node fill */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius * nodeScale}
                fill={`${brandColor}22`}
                stroke={brandColor}
                strokeWidth={2.5}
                style={{ filter: `drop-shadow(0 0 8px ${brandColor}88)` }}
              />
              {/* Label */}
              <foreignObject
                x={node.x - 90}
                y={node.y - 22}
                width={180}
                height={44}
                opacity={labelOpacity}
              >
                <div
                  style={{
                    fontFamily: fontSecondary,
                    fontSize: 19,
                    color: "#ffffff",
                    textAlign: "center",
                    lineHeight: 1.2,
                    textShadow: "0 1px 6px rgba(0,0,0,0.8)",
                  }}
                >
                  {node.label}
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* Central brain node */}
        <circle
          cx={960}
          cy={540}
          r={95 * centralPulse}
          fill={brandColor}
          opacity={0.1}
          style={{ filter: `drop-shadow(0 0 20px ${brandColor})` }}
        />
        <circle
          cx={960}
          cy={540}
          r={72}
          fill={brandColor}
          opacity={0.92}
          style={{ filter: `drop-shadow(0 0 16px ${brandColor})` }}
        />
      </svg>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 100,
          right: 100,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div
          style={{
            height: 4,
            width: 60,
            background: `linear-gradient(90deg, ${brandColor}, ${brandColor}44)`,
            marginBottom: 20,
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
            letterSpacing: "-1px",
          }}
        >
          {text.length > 70 ? text.substring(0, 70) + "…" : text}
        </h1>
      </div>

      <LightLeak opacity={0.05} />
    </AbsoluteFill>
  );
};
