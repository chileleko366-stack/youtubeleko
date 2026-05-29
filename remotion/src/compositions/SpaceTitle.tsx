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
import { ParticleField } from "../lib/particles";
import { GlowText } from "../lib/glowText";
import { easeOutExpo } from "../lib/easing";

export const SpaceTitle: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const words = text.split(" ");

  // Subtitle slides down from above with spring + blur dissolve
  const subtitleSpring = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const subtitleY = interpolate(subtitleSpring, [0, 1], [-48, 0]);
  const subtitleOpacity = interpolate(subtitleSpring, [0, 1], [0, 1]);
  const subtitleBlur = interpolate(subtitleSpring, [0, 1], [8, 0]);

  // Main title words stagger with easeOutExpo
  const wordAnimations = words.map((_, i) => {
    const wordDelay = 12 + i * 6;
    const rawProg = interpolate(frame, [wordDelay, wordDelay + 18], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const prog = easeOutExpo(rawProg);
    return {
      scale: interpolate(prog, [0, 1], [0.7, 1]),
      opacity: interpolate(prog, [0, 1], [0, 1]),
    };
  });

  // Red accent underline — first line draws left to right
  const lineDelay = 12 + words.length * 6;
  const line1Spring = spring({
    frame: Math.max(0, frame - lineDelay),
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const line1Width = interpolate(line1Spring, [0, 1], [0, 60]);

  // Second shorter line draws right to left (bracket)
  const line2Spring = spring({
    frame: Math.max(0, frame - lineDelay - 6),
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const line2Width = interpolate(line2Spring, [0, 1], [0, 30]);

  // Scan light sweep after title fully revealed
  const scanStart = lineDelay + 14;
  const scanX = interpolate(frame, [scanStart, scanStart + 30], [-100, width + 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scanOpacity = interpolate(
    frame,
    [scanStart, scanStart + 4, scanStart + 24, scanStart + 30],
    [0, 0.18, 0.18, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Nebula blob opacities slowly breathe — deterministic using frame
  const nebulaBreath = 0.5 + 0.25 * Math.sin((frame * Math.PI) / 90);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#00000e",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Layer 2: Nebula radial gradients — deep purple/blue/red */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 70% at 50% 50%, rgba(60,0,90,${nebulaBreath * 0.55}) 0%, transparent 65%),
            radial-gradient(ellipse 50% 60% at 15% 30%, rgba(0,10,80,0.45) 0%, transparent 60%),
            radial-gradient(ellipse 45% 55% at 85% 70%, rgba(80,0,30,0.4) 0%, transparent 60%),
            radial-gradient(ellipse 35% 40% at 70% 15%, rgba(20,0,60,0.35) 0%, transparent 55%)
          `,
          pointerEvents: "none",
        }}
      />

      {/* Layer 3: ParticleField — 200 stars, tiny, slow drift */}
      <ParticleField count={200} speedMultiplier={0.3} sizeRange={[0.4, 2.2]} />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 30%, rgba(0,0,10,0.88) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          padding: "0 120px",
          maxWidth: 1500,
          width: "100%",
        }}
      >
        {/* Channel name / subtitle — slides from above */}
        <div
          style={{
            fontFamily: fontSecondary,
            fontSize: 22,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "10px",
            textTransform: "uppercase",
            marginBottom: 36,
            opacity: subtitleOpacity,
            transform: `translateY(${subtitleY}px)`,
            filter: `blur(${subtitleBlur}px)`,
          }}
        >
          RED SPACE FACTS
        </div>

        {/* Main title — word-by-word stagger */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 0.25em",
            marginBottom: 24,
          }}
        >
          {words.map((word, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: wordAnimations[i].opacity,
                transform: `scale(${wordAnimations[i].scale})`,
                transformOrigin: "center bottom",
              }}
            >
              <GlowText
                text={word}
                fontFamily={fontPrimary}
                fontSize={112}
                fontWeight={900}
                color="#ffffff"
                glowColor="rgba(220,30,30,0.9)"
                glowRadius={60}
                letterSpacing="4px"
                textTransform="uppercase"
              />
            </span>
          ))}

          {/* Scan light sweep */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: scanX,
                width: 120,
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
                opacity: scanOpacity,
              }}
            />
          </div>
        </div>

        {/* Red accent bracket lines */}
        <div
          style={{
            position: "relative",
            height: 8,
            marginBottom: 32,
            display: "flex",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {/* Line 1: draws left-to-right */}
          <div
            style={{
              height: 4,
              width: line1Width,
              background: `linear-gradient(90deg, ${brandColor}, rgba(255,80,80,0.4))`,
              borderRadius: 2,
              boxShadow: `0 0 16px ${brandColor}, 0 0 32px rgba(255,68,68,0.4)`,
              alignSelf: "center",
            }}
          />
          {/* Line 2: draws right-to-left (bracket) */}
          <div
            style={{
              height: 4,
              width: line2Width,
              background: `linear-gradient(270deg, ${brandColor}, rgba(255,80,80,0.3))`,
              borderRadius: 2,
              boxShadow: `0 0 12px ${brandColor}`,
              alignSelf: "center",
            }}
          />
        </div>

        {/* Channel label below */}
        <div
          style={{
            fontFamily: fontSecondary,
            fontSize: 18,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "8px",
            textTransform: "uppercase",
            opacity: subtitleOpacity,
          }}
        >
          CH6 — EST. 2024
        </div>
      </div>
    </AbsoluteFill>
  );
};
