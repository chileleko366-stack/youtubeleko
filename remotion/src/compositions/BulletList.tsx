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

export const BulletList: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = bullets ?? text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 5);

  const titleProgress = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);

  // Vertical brand line grows from top as items appear
  const lastItemDelay = (items.length - 1) * 8;
  const lineSpring = spring({
    frame: frame - lastItemDelay,
    fps,
    config: { damping: 22, stiffness: 80 },
  });
  const lineHeight = interpolate(lineSpring, [0, 1], [0, 100]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 120px",
        overflow: "hidden",
      }}
    >
      <GradientBg
        colors={[backgroundColor, `${brandColor}0d`, backgroundColor]}
        angle={160}
        animate
      />

      {/* Vertical accent line growing from top */}
      <div
        style={{
          position: "absolute",
          left: 80,
          top: "10%",
          width: 4,
          height: `${lineHeight * 0.8}%`,
          background: `linear-gradient(180deg, ${brandColor}, ${brandColor}44)`,
          borderRadius: 2,
          boxShadow: `0 0 12px ${brandColor}88`,
        }}
      />

      {/* Section header bar */}
      <div
        style={{
          width: interpolate(titleProgress, [0, 1], [0, 100]),
          height: 6,
          background: `linear-gradient(90deg, ${brandColor}, ${brandColor}44)`,
          marginBottom: 40,
          opacity: titleOpacity,
          borderRadius: 3,
          boxShadow: `0 0 16px ${brandColor}66`,
        }}
      />

      {/* Bullet items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28, position: "relative" }}>
        {items.map((item, index) => {
          const itemDelay = index * 8;
          const itemSpring = spring({
            frame: frame - itemDelay,
            fps,
            config: { damping: 12, stiffness: 160, mass: 0.6 },
          });
          const opacity = interpolate(itemSpring, [0, 1], [0, 1]);
          const x = interpolate(
            easeOutElastic(Math.min(itemSpring, 1)),
            [0, 1],
            [-80, 0]
          );

          // Zebra-effect: slightly lighter rows
          const zebraOpacity = index % 2 === 0 ? 0.04 : 0;

          return (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 24,
                opacity,
                transform: `translateX(${x}px)`,
                position: "relative",
                padding: "12px 20px 12px 0",
                borderRadius: 8,
                background: `rgba(255,255,255,${zebraOpacity})`,
              }}
            >
              {/* Animated SVG arrow bullet */}
              <svg
                width={36}
                height={36}
                viewBox="0 0 36 36"
                style={{ flexShrink: 0, marginTop: 6 }}
              >
                <circle
                  cx={18}
                  cy={18}
                  r={16}
                  fill={`${brandColor}22`}
                  stroke={brandColor}
                  strokeWidth={2}
                />
                <path
                  d="M12 18 L22 18 M18 13 L24 18 L18 23"
                  stroke={brandColor}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>

              <p
                style={{
                  fontFamily: fontSecondary,
                  fontSize: 38,
                  color: "#ffffff",
                  lineHeight: 1.45,
                  margin: 0,
                }}
              >
                {item}
              </p>
            </div>
          );
        })}
      </div>

      <LightLeak opacity={0.05} />
    </AbsoluteFill>
  );
};
