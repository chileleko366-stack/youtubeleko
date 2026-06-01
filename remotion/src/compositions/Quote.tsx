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
import { ParticleField } from "../lib/particles";
import { LightLeak } from "../lib/lightLeak";
import { easeOutBack, easeOutExpo } from "../lib/easing";
import { CameraRig } from "../lib/camera";
import { GlassCard } from "../lib/glassCard";

export const Quote: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  quoteText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const displayText = quoteText ?? text;
  const words = displayText.split(" ");

  // Quotation marks with easeOutBack overshoot
  const quoteMarkSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.5 },
  });
  const quoteMarkScale = interpolate(
    easeOutBack(Math.min(quoteMarkSpring, 1)),
    [0, 1],
    [0, 1]
  );
  const quoteMarkOpacity = interpolate(quoteMarkSpring, [0, 0.4], [0, 1]);

  // Attribution slides up
  const attributionProgress = spring({
    frame: frame - words.length * 3 - 10,
    fps,
    config: { damping: 22, stiffness: 100 },
  });
  const attributionOpacity = interpolate(attributionProgress, [0, 1], [0, 1]);
  const attributionY = interpolate(attributionProgress, [0, 1], [30, 0]);
  const attributionBlur = interpolate(attributionProgress, [0, 1], [8, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      {/* Deep radial vignette */}
      <GradientBg
        colors={[`${backgroundColor}`, `${brandColor}0d`, `${backgroundColor}`]}
        angle={90}
        animate={false}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, transparent 25%, rgba(0,0,0,0.85) 100%)",
          pointerEvents: "none",
        }}
      />

      <ParticleField count={30} color={brandColor} opacity={0.12} speed={0.4} size={[1, 2]} />

      <CameraRig driftPct={1.5}>
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
        <div style={{ position: "relative", maxWidth: 1300, width: "100%" }}>
          {/* Opening quote mark — easeOutBack scale-in */}
          <div
            style={{
              fontFamily: fontPrimary,
              fontSize: 200,
              color: brandColor,
              lineHeight: 0.6,
              marginBottom: 20,
              opacity: quoteMarkOpacity,
              transform: `scale(${quoteMarkScale})`,
              transformOrigin: "left top",
              textShadow: `0 0 40px ${brandColor}88`,
            }}
          >
            "
          </div>

          {/* Word-by-word spring reveal */}
          <div
            style={{
              fontFamily: fontSecondary,
              fontSize: 52,
              fontStyle: "italic",
              color: "#ffffff",
              lineHeight: 1.5,
              margin: "0 0 40px",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.3em",
            }}
          >
            {words.map((word, i) => {
              const wSpring = spring({
                frame: frame - i * 3,
                fps,
                config: { damping: 20, stiffness: 140 },
              });
              const wT = Math.min(wSpring, 1);
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    opacity: easeOutExpo(wT),
                    transform: `translateY(${interpolate(easeOutExpo(wT), [0, 1], [16, 0])}px)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Brand-colored accent line */}
          <div
            style={{
              width: 200,
              height: 4,
              background: `linear-gradient(90deg, ${brandColor}, ${brandColor}33)`,
              marginLeft: "auto",
              marginBottom: 24,
              borderRadius: 2,
              boxShadow: `0 0 12px ${brandColor}66`,
              opacity: attributionOpacity,
            }}
          />

          {/* Attribution */}
          <div
            style={{
              opacity: attributionOpacity,
              transform: `translateY(${attributionY}px)`,
              filter: `blur(${attributionBlur}px)`,
              textAlign: "right",
            }}
          >
            <span
              style={{
                fontFamily: fontSecondary,
                fontSize: 28,
                color: brandColor,
                letterSpacing: "3px",
                textTransform: "uppercase",
              }}
            >
              — SOURCE
            </span>
          </div>
        </div>
      </div>
      </CameraRig>

      <LightLeak opacity={0.06} />
    </AbsoluteFill>
  );
};
