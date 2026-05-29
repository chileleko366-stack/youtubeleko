import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

const PARTICLES = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.3,
  opacity: Math.random() * 0.5 + 0.1,
  twinkle: Math.random() * 70,
}));

export const SpaceQuote: React.FC<CompositionProps> = ({
  quoteText,
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const quote = quoteText ?? text;
  const words = quote.split(" ");

  // Big quotation mark
  const quoteMarkSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 70 },
  });
  const quoteMarkOpacity = interpolate(quoteMarkSpring, [0, 1], [0, 1]);
  const quoteMarkScale = interpolate(quoteMarkSpring, [0, 1], [1.6, 1]);

  // Attribution
  const attrSpring = spring({
    frame: Math.max(0, frame - Math.min(30 + words.length * 2, 55)),
    fps,
    config: { damping: 20, stiffness: 90 },
  });
  const attrOpacity = interpolate(attrSpring, [0, 1], [0, 1]);
  const attrY = interpolate(attrSpring, [0, 1], [20, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Star particles */}
      {PARTICLES.map((p) => {
        const tw =
          0.3 +
          0.7 * Math.abs(Math.sin(((frame + p.twinkle) * Math.PI) / 60));
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              opacity: p.opacity * tw,
              transform: "translate(-50%,-50%)",
            }}
          />
        );
      })}

      {/* Deep space background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 100% 80% at 50% 50%, rgba(20,0,50,0.7) 0%, rgba(0,0,20,0.4) 60%, transparent 100%)",
        }}
      />

      {/* Horizontal accent lines */}
      {[0.28, 0.72].map((y, i) => {
        const lineSpring = spring({
          frame: Math.max(0, frame - i * 8),
          fps,
          config: { damping: 20, stiffness: 60 },
        });
        const lw = interpolate(lineSpring, [0, 1], [0, 100]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${y * 100}%`,
              left: 0,
              height: 1,
              width: `${lw}%`,
              background: `linear-gradient(${
                i === 0 ? "90deg" : "270deg"
              }, transparent, rgba(255,68,68,0.25), transparent)`,
            }}
          />
        );
      })}

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 30%, rgba(0,0,8,0.85) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          maxWidth: 1300,
          padding: "0 120px",
          textAlign: "center",
        }}
      >
        {/* Large quotation mark */}
        <div
          style={{
            fontFamily: fontPrimary,
            fontSize: 260,
            color: brandColor,
            lineHeight: 0.6,
            marginBottom: 20,
            opacity: quoteMarkOpacity,
            transform: `scale(${quoteMarkScale})`,
            transformOrigin: "center bottom",
            textShadow: `0 0 60px rgba(255,68,68,0.4), 0 0 120px rgba(255,68,68,0.15)`,
            userSelect: "none",
          }}
        >
          "
        </div>

        {/* Quote text — word by word reveal */}
        <p
          style={{
            fontFamily: fontSecondary,
            fontSize: 44,
            fontWeight: 300,
            color: "#ffffff",
            lineHeight: 1.55,
            margin: "0 0 48px",
            letterSpacing: "0.5px",
            textShadow: "0 2px 20px rgba(0,0,0,0.8)",
          }}
        >
          {words.map((word, i) => {
            const wordDelay = 8 + i * 2.2;
            const wOpacity = interpolate(
              frame,
              [wordDelay, wordDelay + 6],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const wY = interpolate(
              frame,
              [wordDelay, wordDelay + 6],
              [12, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <span
                key={i}
                style={{
                  opacity: wOpacity,
                  display: "inline-block",
                  transform: `translateY(${wY}px)`,
                  marginRight: "0.28em",
                }}
              >
                {word}
              </span>
            );
          })}
        </p>

        {/* Divider */}
        <div
          style={{
            width: 100,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
            margin: "0 auto 28px",
            opacity: attrOpacity,
            boxShadow: `0 0 12px ${brandColor}`,
          }}
        />

        {/* Attribution */}
        <div
          style={{
            fontFamily: fontSecondary,
            fontSize: 22,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "5px",
            textTransform: "uppercase",
            opacity: attrOpacity,
            transform: `translateY(${attrY}px)`,
          }}
        >
          RED SPACE FACTS — CH6
        </div>
      </div>
    </AbsoluteFill>
  );
};
