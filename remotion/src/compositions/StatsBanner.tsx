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
import { ParticleField } from "../lib/particles";
import { easeOutExpo, easeOutElastic } from "../lib/easing";

export const StatsBanner: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  statValue,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const bannerProgress = spring({ frame, fps, config: { damping: 20, stiffness: 100 } });
  const statProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  const unitsProgress = spring({
    frame: frame - 22,
    fps,
    config: { damping: 22, stiffness: 100 },
  });

  // easeOutExpo for fast snap-in on the banner line
  const bannerT = Math.min(bannerProgress, 1);
  const bannerWidth = interpolate(easeOutExpo(bannerT), [0, 1], [0, 100]);

  // easeOutElastic impact pop on the stat value (scale 1.1 → 1.0)
  const statT = Math.min(statProgress, 1);
  const statScale = 1.1 - 0.1 * easeOutElastic(statT);
  const statOpacity = interpolate(statProgress, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
  const unitsOpacity = interpolate(unitsProgress, [0, 1], [0, 1]);
  const unitsY = interpolate(unitsProgress, [0, 1], [20, 0]);

  // Extract numeric part vs unit suffix
  const rawStat = statValue ?? text.match(/\b[\d,.%$£€]+\b/)?.[0] ?? "";
  const numericPart = rawStat.replace(/[^0-9]/g, "");
  const numericVal = parseInt(numericPart, 10) || 0;
  const suffix = rawStat.replace(/[0-9]/g, "");

  // Count-up from 0
  const countedVal = Math.round(
    interpolate(statProgress, [0, 1], [0, numericVal], {
      extrapolateRight: "clamp",
    })
  );
  const displayStat = rawStat
    ? rawStat.replace(numericPart, String(countedVal))
    : "";

  // Circular progress ring
  const ringRadius = 220;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringProgress = interpolate(statProgress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const ringDash = ringCircumference * ringProgress;
  const ringGap = ringCircumference - ringDash;

  // Background pulse
  const bgPulse = interpolate(
    Math.sin(frame * 0.06),
    [-1, 1],
    [0.03, 0.08]
  );

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      <GradientBg
        colors={[backgroundColor, `${brandColor}${Math.round(bgPulse * 255).toString(16).padStart(2, "0")}`, backgroundColor]}
        angle={120}
        animate
      />

      <ParticleField count={30} color={brandColor} opacity={0.15} speed={0.5} size={[1, 2]} />

      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: "50%",
          transform: "translateX(-50%)",
          width: `${bannerWidth}%`,
          height: 6,
          background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
          borderRadius: 3,
          boxShadow: `0 0 20px ${brandColor}88`,
        }}
      />

      {/* Central content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {/* SVG progress ring */}
        {displayStat && (
          <div style={{ position: "relative", width: 500, height: 500 }}>
            <svg
              style={{ position: "absolute", inset: 0 }}
              viewBox="0 0 500 500"
              width={500}
              height={500}
            >
              {/* Track */}
              <circle
                cx={250}
                cy={250}
                r={ringRadius}
                fill="none"
                stroke={`${brandColor}22`}
                strokeWidth={6}
              />
              {/* Progress */}
              <circle
                cx={250}
                cy={250}
                r={ringRadius}
                fill="none"
                stroke={brandColor}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={`${ringDash} ${ringGap}`}
                strokeDashoffset={ringCircumference / 4}
                style={{ filter: `drop-shadow(0 0 8px ${brandColor})` }}
              />
            </svg>

            {/* Stat value centered */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                opacity: statOpacity,
                transform: `scale(${statScale})`,
              }}
            >
              <GlowText
                text={displayStat}
                color={brandColor}
                fontSize={110}
                fontFamily={fontPrimary}
                glowColor={brandColor}
                glowRadius={32}
                style={{ fontWeight: 900, lineHeight: 1 }}
              />
            </div>
          </div>
        )}

        {/* Units / label */}
        <div
          style={{
            opacity: unitsOpacity,
            transform: `translateY(${unitsY}px)`,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: fontSecondary,
              fontSize: 38,
              color: "#ffffff",
              margin: 0,
              textAlign: "center",
              maxWidth: 1200,
              lineHeight: 1.4,
              padding: "0 80px",
            }}
          >
            {text}
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          width: `${bannerWidth * 0.6}%`,
          height: 4,
          background: `linear-gradient(90deg, transparent, ${brandColor}88, transparent)`,
          borderRadius: 2,
        }}
      />

      <LightLeak opacity={0.06} />
    </AbsoluteFill>
  );
};
