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
import { GlowText } from "../lib/glowText";
import { LightLeak } from "../lib/lightLeak";
import { easeOutBack } from "../lib/easing";
import { CameraRig } from "../lib/camera";

export const CelebrityCard: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardSpring = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const textProgress = spring({
    frame: frame - 12,
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const ruleSpring = spring({
    frame: frame - 18,
    fps,
    config: { damping: 22, stiffness: 120 },
  });

  const cardY = interpolate(cardSpring, [0, 1], [220, 0]);
  const cardShadow = interpolate(cardSpring, [0, 1], [0, 60]);
  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);
  const textX = interpolate(textProgress, [0, 1], [60, 0]);

  // Letter-spacing animation: wide → normal
  const letterSpacing = interpolate(
    easeOutBack(Math.min(textProgress, 1)),
    [0, 1],
    [24, 0]
  );

  // Horizontal rule draws left→right
  const ruleWidth = interpolate(ruleSpring, [0, 1], [0, 80]);

  // Shimmer position across card
  const shimmerX = interpolate(frame, [0, 90], [-100, 200]);

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      <GradientBg
        colors={[backgroundColor, `${brandColor}0d`, backgroundColor]}
        angle={160}
        animate
      />

      <CameraRig driftPct={1.5}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 100px",
          gap: 60,
        }}
      >
        {/* Celebrity card */}
        <div
          style={{
            width: 400,
            height: 500,
            borderRadius: 16,
            backgroundColor: "#1a1a1a",
            border: `3px solid ${brandColor}`,
            flexShrink: 0,
            transform: `translateY(${cardY}px)`,
            boxShadow: `0 ${cardShadow}px ${cardShadow * 2}px rgba(0,0,0,0.7), 0 0 ${cardShadow * 0.5}px ${brandColor}44`,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, #1a1a1a 0%, ${brandColor}33 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: "50%",
                background: `radial-gradient(circle at 40% 35%, ${brandColor}88, ${brandColor}22)`,
                boxShadow: `0 0 40px ${brandColor}66`,
              }}
            />
          </div>
          {/* Shimmer overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(105deg, transparent ${shimmerX - 20}%, rgba(255,255,255,0.08) ${shimmerX}%, transparent ${shimmerX + 20}%)`,
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Text content */}
        <div
          style={{
            flex: 1,
            opacity: textOpacity,
            transform: `translateX(${textX}px)`,
          }}
        >
          {/* Animated horizontal rule */}
          <div
            style={{
              width: `${ruleWidth}%`,
              height: 4,
              background: `linear-gradient(90deg, ${brandColor}, ${brandColor}44)`,
              marginBottom: 28,
              borderRadius: 2,
              boxShadow: `0 0 12px ${brandColor}88`,
            }}
          />

          <GlowText
            text={text}
            color="#ffffff"
            fontSize={58}
            fontFamily={fontPrimary}
            glowColor={brandColor}
            glowRadius={18}
            style={{
              fontWeight: 900,
              lineHeight: 1.2,
              textTransform: "uppercase",
              letterSpacing: `${letterSpacing}px`,
              display: "block",
              marginBottom: 24,
            }}
          />

          <p
            style={{
              fontFamily: fontSecondary,
              fontSize: 28,
              color: brandColor,
              margin: 0,
              letterSpacing: "4px",
              textTransform: "uppercase",
              textShadow: `0 0 16px ${brandColor}88`,
            }}
          >
            DOPAMINE LOOP
          </p>
        </div>
      </div>
      </CameraRig>

      <LightLeak opacity={0.07} />
    </AbsoluteFill>
  );
};
