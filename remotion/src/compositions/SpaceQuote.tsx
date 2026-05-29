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
import { easeOutBack } from "../lib/easing";

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

  // Big quotation mark — scales in from 2x with easeOutBack bounce
  const quoteMarkRaw = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  const quoteMarkScale = easeOutBack(Math.min(quoteMarkRaw, 1));
  const quoteMarkOpacity = interpolate(quoteMarkRaw, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Each word: staggered spring 8 frames apart + blur→sharp
  const wordAnims = words.map((_, i) => {
    const wordDelay = 10 + i * 3;
    const wSpring = spring({
      frame: Math.max(0, frame - wordDelay),
      fps,
      config: { damping: 16, stiffness: 120 },
    });
    return {
      opacity: interpolate(wSpring, [0, 1], [0, 1]),
      y: interpolate(wSpring, [0, 1], [12, 0]),
      blur: interpolate(wSpring, [0, 1], [5, 0]),
    };
  });

  // Shimmering underline draws left to right
  const allWordsDelay = 10 + words.length * 3;
  const underlineSpring = spring({
    frame: Math.max(0, frame - allWordsDelay),
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const underlineWidth = interpolate(underlineSpring, [0, 1], [0, 100]);

  // Attribution slides up from bottom with spring + fade
  const attrDelay = allWordsDelay + 8;
  const attrSpring = spring({
    frame: Math.max(0, frame - attrDelay),
    fps,
    config: { damping: 20, stiffness: 90 },
  });
  const attrOpacity = interpolate(attrSpring, [0, 1], [0, 1]);
  const attrY = interpolate(attrSpring, [0, 1], [30, 0]);

  // Nebula blobs drift — deterministic
  const nebulaA = 0.35 + 0.15 * Math.sin((frame * Math.PI) / 80);
  const nebulaB = 0.3 + 0.15 * Math.cos((frame * Math.PI) / 100 + 1);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000008",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Full-screen radial gradient: black center → deep purple/blue edges */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 100% 80% at 50% 50%, rgba(0,0,0,0) 30%, rgba(30,0,70,${nebulaA}) 70%, rgba(0,10,60,${nebulaB}) 100%)
          `,
        }}
      />

      {/* ParticleField — 40 particles, warm white, very slow */}
      <ParticleField count={40} speedMultiplier={0.15} sizeRange={[0.4, 1.6]} />

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
        {/* Large quotation mark — top-left, easeOutBack bounce, deep red */}
        <div
          style={{
            fontFamily: fontPrimary,
            fontSize: 280,
            color: brandColor,
            lineHeight: 0.55,
            marginBottom: 16,
            opacity: quoteMarkOpacity,
            transform: `scale(${quoteMarkScale})`,
            transformOrigin: "left bottom",
            textAlign: "left",
            textShadow: `0 0 60px rgba(255,68,68,0.5), 0 0 120px rgba(255,68,68,0.2)`,
            userSelect: "none",
          }}
        >
          "
        </div>

        {/* Quote text — word by word reveal with blur→sharp */}
        <p
          style={{
            fontFamily: fontSecondary,
            fontSize: 44,
            fontWeight: 300,
            color: "#ffffff",
            lineHeight: 1.55,
            margin: "0 0 32px",
            letterSpacing: "0.5px",
            textShadow: "0 2px 20px rgba(0,0,0,0.8)",
          }}
        >
          {words.map((word, i) => (
            <span
              key={i}
              style={{
                opacity: wordAnims[i].opacity,
                display: "inline-block",
                transform: `translateY(${wordAnims[i].y}px)`,
                filter: `blur(${wordAnims[i].blur}px)`,
                marginRight: "0.28em",
              }}
            >
              {word}
            </span>
          ))}
        </p>

        {/* Shimmering underline draws left-to-right */}
        <div
          style={{
            position: "relative",
            height: 2,
            marginBottom: 28,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${underlineWidth}%`,
              background: `linear-gradient(90deg, ${brandColor}, rgba(255,160,160,0.6), ${brandColor})`,
              boxShadow: `0 0 12px ${brandColor}`,
              borderRadius: 1,
            }}
          />
        </div>

        {/* Attribution — slides up from bottom */}
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
