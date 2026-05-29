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

export const Timeline: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = bullets ?? text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 4);

  // Main line draws from left
  const lineProgress = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const lineWidth = interpolate(lineProgress, [0, 1], [0, 100]);

  // Leading glow dot position
  const dotX = interpolate(lineProgress, [0, 1], [0, 100]);

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      <GradientBg
        colors={[backgroundColor, `${brandColor}0d`, backgroundColor]}
        angle={170}
        animate
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 140px",
        }}
      >
        <div style={{ width: "100%", position: "relative" }}>
          {/* Horizontal timeline line */}
          <div
            style={{
              position: "relative",
              height: 4,
              width: "100%",
              backgroundColor: `${brandColor}22`,
              borderRadius: 2,
              marginBottom: 80,
            }}
          >
            {/* Drawn portion with gradient */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${lineWidth}%`,
                background: `linear-gradient(90deg, ${brandColor}44, ${brandColor})`,
                borderRadius: 2,
                boxShadow: `0 0 12px ${brandColor}66`,
              }}
            />
            {/* Glowing leading dot */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: `${dotX}%`,
                width: 14,
                height: 14,
                borderRadius: "50%",
                backgroundColor: brandColor,
                transform: "translate(-50%, -50%)",
                boxShadow: `0 0 20px ${brandColor}, 0 0 40px ${brandColor}88`,
              }}
            />
          </div>

          {/* Milestone items along the line */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 20,
              marginTop: -60,
            }}
          >
            {items.map((item, index) => {
              const nodeDelay = index * 8 + 4;
              const nodeSpring = spring({
                frame: frame - nodeDelay,
                fps,
                config: { damping: 8, stiffness: 250, mass: 0.4 },
              });
              const nodeScale = interpolate(
                easeOutElastic(Math.min(nodeSpring, 1)),
                [0, 1],
                [0, 1]
              );
              const nodeOpacity = interpolate(nodeSpring, [0, 0.3], [0, 1]);

              const textSpring = spring({
                frame: frame - nodeDelay - 6,
                fps,
                config: { damping: 22, stiffness: 100 },
              });
              const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
              const textY = interpolate(textSpring, [0, 1], [20, 0]);

              return (
                <div
                  key={index}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  {/* Milestone node */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      backgroundColor: brandColor,
                      transform: `scale(${nodeScale})`,
                      opacity: nodeOpacity,
                      boxShadow: `0 0 24px ${brandColor}, 0 0 48px ${brandColor}66`,
                      marginTop: -14,
                      marginBottom: 24,
                      flexShrink: 0,
                    }}
                  />

                  {/* Label */}
                  <p
                    style={{
                      fontFamily: fontSecondary,
                      fontSize: 28,
                      color: "#ffffff",
                      lineHeight: 1.4,
                      margin: 0,
                      textAlign: "center",
                      opacity: textOpacity,
                      transform: `translateY(${textY}px)`,
                    }}
                  >
                    {item}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <LightLeak opacity={0.06} />
    </AbsoluteFill>
  );
};
