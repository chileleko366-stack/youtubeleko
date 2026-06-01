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
import { easeOutExpo } from "../lib/easing";

export const SplitScreen: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const leftText = sentences[0] ?? text;
  const rightText = sentences[1] ?? "";
  const leftWords = leftText.split(" ");
  const rightWords = (rightText || leftText).split(" ");

  // Panels slide in
  const leftSpring = spring({ frame, fps, config: { damping: 22, stiffness: 130, mass: 0.8 } });
  const rightSpring = spring({ frame: frame - 8, fps, config: { damping: 22, stiffness: 130, mass: 0.8 } });
  // easeOutExpo for snappy panel slide-in
  const leftT = Math.min(leftSpring, 1);
  const rightT = Math.min(rightSpring, 1);
  const leftX = interpolate(easeOutExpo(leftT), [0, 1], [-960, 0]);
  const rightX = interpolate(easeOutExpo(rightT), [0, 1], [960, 0]);
  const leftBlur = interpolate(easeOutExpo(leftT), [0, 1], [12, 0]);
  const rightBlur = interpolate(easeOutExpo(rightT), [0, 1], [12, 0]);

  // Divider line draws from center outward
  const dividerSpring = spring({ frame: frame - 4, fps, config: { damping: 10, stiffness: 200, mass: 0.4 } });
  const dividerHeight = interpolate(dividerSpring, [0, 1], [0, 100]);
  const dividerTop = (100 - dividerHeight) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor, flexDirection: "row", overflow: "hidden" }}>
      {/* Left panel */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          transform: `translateX(${leftX}px)`,
          filter: `blur(${leftBlur}px)`,
        }}
      >
        <GradientBg
          colors={[brandColor, `${brandColor}cc`, `${brandColor}88`]}
          angle={160}
          animate
        />
        <ParticleField count={25} color="#000000" opacity={0.08} speed={0.8} size={[1, 3]} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 60,
          }}
        >
          <p
            style={{
              fontFamily: fontPrimary,
              fontSize: 52,
              fontWeight: 900,
              color: "#000000",
              lineHeight: 1.2,
              margin: 0,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "-0.5px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.25em",
            }}
          >
            {leftWords.map((word, i) => {
              const wSpring = spring({
                frame: frame - i * 4,
                fps,
                config: { damping: 18, stiffness: 160 },
              });
              const wT = Math.min(wSpring, 1);
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    opacity: easeOutExpo(wT),
                    transform: `translateY(${interpolate(easeOutExpo(wT), [0, 1], [20, 0])}px)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </p>
        </div>
      </div>

      {/* Divider with brand-color particle stream */}
      <div
        style={{
          width: 6,
          position: "relative",
          backgroundColor: "#000000",
          overflow: "hidden",
          zIndex: 10,
        }}
      >
        {/* Glowing center line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${dividerTop}%`,
            height: `${dividerHeight}%`,
            background: `linear-gradient(180deg, transparent, ${brandColor}, ${brandColor}, transparent)`,
            boxShadow: `0 0 20px ${brandColor}, 0 0 40px ${brandColor}88`,
          }}
        />
        {/* Particle stream along divider */}
        {Array.from({ length: 8 }).map((_, i) => {
          const pY = ((frame * 2 + i * 135) % 1080) / 10.8;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: `${pY}%`,
                width: 4,
                height: 4,
                borderRadius: "50%",
                backgroundColor: brandColor,
                transform: "translateX(-50%)",
                opacity: 0.7,
                boxShadow: `0 0 8px ${brandColor}`,
              }}
            />
          );
        })}
      </div>

      {/* Right panel */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          transform: `translateX(${rightX}px)`,
          filter: `blur(${rightBlur}px)`,
        }}
      >
        <GradientBg
          colors={[backgroundColor, `${brandColor}11`, backgroundColor]}
          angle={20}
          animate
        />
        <ParticleField count={25} color={brandColor} opacity={0.12} speed={0.7} size={[1, 2]} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 60,
          }}
        >
          <p
            style={{
              fontFamily: fontSecondary,
              fontSize: 40,
              color: "#ffffff",
              lineHeight: 1.4,
              margin: 0,
              textAlign: "center",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "0.3em",
            }}
          >
            {rightWords.map((word, i) => {
              const wSpring = spring({
                frame: frame - 12 - i * 4,
                fps,
                config: { damping: 18, stiffness: 160 },
              });
              const wT = Math.min(wSpring, 1);
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    opacity: easeOutExpo(wT),
                    transform: `translateY(${interpolate(easeOutExpo(wT), [0, 1], [20, 0])}px)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};
