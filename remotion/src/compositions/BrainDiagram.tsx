import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

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

  const bgProgress = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 60 },
  });
  const titleProgress = spring({
    frame: frame - 5,
    fps,
    config: { damping: 22, stiffness: 100 },
  });

  const bgOpacity = interpolate(bgProgress, [0, 1], [0, 1]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [-25, 0]);

  // Build nodes from bullets or split text
  const rawItems = bullets && bullets.length > 0
    ? bullets.slice(0, 5)
    : text.split(/[,.;]/).map((s) => s.trim()).filter(Boolean).slice(0, 5);

  const nodes: Node[] = rawItems.map((item, i) => {
    const angle = (i / rawItems.length) * Math.PI * 2 - Math.PI / 2;
    const radius = 220;
    return {
      x: 960 + Math.cos(angle) * radius,
      y: 540 + Math.sin(angle) * radius,
      label: item.length > 20 ? item.substring(0, 20) + "..." : item,
      radius: 70,
    };
  });

  // Pulsing central node
  const pulseScale = 1 + interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0, 0.06]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        opacity: bgOpacity,
      }}
    >
      {/* SVG connections and nodes */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 1920 1080"
      >
        {/* Connection lines */}
        {nodes.map((node, i) => {
          const lineProgress = spring({
            frame: frame - i * 5 - 8,
            fps,
            config: { damping: 20, stiffness: 60 },
          });
          const lineOpacity = interpolate(lineProgress, [0, 1], [0, 0.5]);
          return (
            <line
              key={`line-${i}`}
              x1={960}
              y1={540}
              x2={node.x}
              y2={node.y}
              stroke={brandColor}
              strokeWidth={2}
              opacity={lineOpacity}
              strokeDasharray="8 4"
            />
          );
        })}

        {/* Satellite nodes */}
        {nodes.map((node, i) => {
          const nodeProgress = spring({
            frame: frame - i * 5 - 10,
            fps,
            config: { damping: 18, stiffness: 80 },
          });
          const nodeOpacity = interpolate(nodeProgress, [0, 1], [0, 1]);
          const nodeScale = interpolate(nodeProgress, [0, 1], [0.4, 1]);

          return (
            <g key={`node-${i}`} opacity={nodeOpacity}>
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius * nodeScale}
                fill={`${brandColor}22`}
                stroke={brandColor}
                strokeWidth={2}
              />
              <foreignObject
                x={node.x - 80}
                y={node.y - 20}
                width={160}
                height={40}
              >
                <div
                  style={{
                    fontFamily: fontSecondary,
                    fontSize: 18,
                    color: "#ffffff",
                    textAlign: "center",
                    lineHeight: 1.2,
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
          r={90 * pulseScale}
          fill={brandColor}
          opacity={0.15}
        />
        <circle
          cx={960}
          cy={540}
          r={70}
          fill={brandColor}
          opacity={0.9}
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
            backgroundColor: brandColor,
            marginBottom: 20,
            borderRadius: 2,
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
          {text.length > 70 ? text.substring(0, 70) + "..." : text}
        </h1>
      </div>
    </AbsoluteFill>
  );
};
