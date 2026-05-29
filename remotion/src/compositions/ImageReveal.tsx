import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";
import { GlowText } from "../lib/glowText";
import { LightLeak } from "../lib/lightLeak";

export const ImageReveal: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const revealProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 60 },
  });
  const textProgress = spring({
    frame: frame - 18,
    fps,
    config: { damping: 22, stiffness: 100 },
  });

  // Iris wipe: circle expands from center
  const clipRadius = interpolate(revealProgress, [0, 1], [0, 1600]);

  // Ken Burns zoom
  const kenBurnsScale = interpolate(frame, [0, durationInFrames], [1.0, 1.06]);

  const textOpacity = interpolate(textProgress, [0, 1], [0, 1]);
  const textY = interpolate(textProgress, [0, 1], [40, 0]);

  // Border draws around frame after reveal
  const borderProgress = spring({
    frame: frame - 20,
    fps,
    config: { damping: 22, stiffness: 80 },
  });
  const borderOpacity = interpolate(borderProgress, [0, 1], [0, 1]);

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const clipId = "iris-clip";

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <circle cx={960} cy={540} r={clipRadius} />
          </clipPath>
        </defs>
      </svg>

      {/* Image area clipped by iris */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: `url(#${clipId})`,
          opacity: fadeOut,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${kenBurnsScale})`,
            transformOrigin: "center center",
            background: `linear-gradient(135deg, ${brandColor}22 0%, ${brandColor}44 50%, #000000 100%)`,
          }}
        >
          {/* Geometric accents */}
          <div
            style={{
              position: "absolute",
              top: "10%",
              right: "5%",
              width: 240,
              height: 240,
              border: `3px solid ${brandColor}`,
              borderRadius: "50%",
              opacity: 0.3,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "18%",
              left: "8%",
              width: 130,
              height: 130,
              backgroundColor: `${brandColor}33`,
              transform: "rotate(45deg)",
            }}
          />
        </div>

        {/* Vignette post-reveal */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Brand-colored border around frame */}
      <div
        style={{
          position: "absolute",
          inset: 8,
          border: `3px solid ${brandColor}`,
          borderRadius: 4,
          opacity: borderOpacity * 0.5 * fadeOut,
          boxShadow: `inset 0 0 20px ${brandColor}33, 0 0 20px ${brandColor}33`,
          pointerEvents: "none",
        }}
      />

      {/* Text overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 100,
          right: 100,
          opacity: textOpacity * fadeOut,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            height: 4,
            width: 80,
            background: `linear-gradient(90deg, ${brandColor}, ${brandColor}44)`,
            marginBottom: 24,
            borderRadius: 2,
            boxShadow: `0 0 12px ${brandColor}88`,
          }}
        />
        <GlowText
          text={text}
          color="#ffffff"
          fontSize={52}
          fontFamily={fontPrimary}
          glowColor={brandColor}
          glowRadius={16}
          style={{
            fontWeight: 900,
            lineHeight: 1.2,
            textShadow: "0 2px 20px rgba(0,0,0,0.8)",
          }}
        />
      </div>

      <LightLeak opacity={0.07} />
    </AbsoluteFill>
  );
};
