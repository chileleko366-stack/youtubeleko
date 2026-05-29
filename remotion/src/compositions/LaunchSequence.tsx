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

// Each countdown number: 8 frames in, 12 frames hold, fade out
const FRAMES_PER_NUMBER = 14;
const COUNTDOWN_START = 5;
const LAUNCH_FRAME = COUNTDOWN_START * FRAMES_PER_NUMBER; // 70

// Distinct glow color per number: 5=purple, 4=blue, 3=cyan, 2=yellow, 1=orange, 0=red
const NUMBER_COLORS = [
  "rgba(200,0,0,1)",    // 0 — red
  "rgba(255,120,0,1)",  // 1 — orange
  "rgba(255,220,0,1)",  // 2 — yellow
  "rgba(0,230,230,1)",  // 3 — cyan
  "rgba(30,80,255,1)",  // 4 — blue
  "rgba(160,0,255,1)",  // 5 — purple
];
const NUMBER_GLOW_COLORS = [
  "rgba(200,0,0,0.8)",
  "rgba(255,120,0,0.7)",
  "rgba(255,220,0,0.7)",
  "rgba(0,230,230,0.7)",
  "rgba(30,80,255,0.7)",
  "rgba(160,0,255,0.7)",
];

// Deterministic star field
const BG_STARS = Array.from({ length: 160 }, (_, i) => ({
  id: i,
  x: random(`ls-x-${i}`) * 100,
  y: random(`ls-y-${i}`) * 100,
  size: random(`ls-s-${i}`) * 2 + 0.4,
  opacity: random(`ls-o-${i}`) * 0.5 + 0.1,
  tw: random(`ls-t-${i}`) * 60,
  speed: 30 + random(`ls-sp-${i}`) * 40,
}));

export const LaunchSequence: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isLaunched = frame >= LAUNCH_FRAME;

  // Which digit are we on?
  const digitIndex = Math.min(COUNTDOWN_START, Math.floor(frame / FRAMES_PER_NUMBER));
  const digitFrame = frame % FRAMES_PER_NUMBER;
  const currentNumber = COUNTDOWN_START - digitIndex;

  // Each number SLAMS in with scale(3→1) + opacity(0→1) in 8 frames
  const inSpring = spring({
    frame: digitFrame,
    fps,
    config: { damping: 5, stiffness: 300, mass: 0.5 },
  });
  const inScale = interpolate(inSpring, [0, 1], [3.0, 1]);
  const inOpacity = interpolate(inSpring, [0, 0.2], [0, 1], {
    extrapolateRight: "clamp",
  });
  // Fades with scale(1→0.5) in last 4 frames
  const outOpacity = interpolate(
    digitFrame,
    [FRAMES_PER_NUMBER - 4, FRAMES_PER_NUMBER],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const outScale = interpolate(
    digitFrame,
    [FRAMES_PER_NUMBER - 4, FRAMES_PER_NUMBER],
    [1, 0.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const combinedOpacity = inOpacity * outOpacity;
  const combinedScale = inScale * outScale;

  // Pulsing ring around each number
  const pulseRing = 1 + 0.15 * Math.abs(Math.sin((digitFrame * Math.PI) / 6));
  const pulseOpacity = 0.4 - 0.3 * Math.abs(Math.sin((digitFrame * Math.PI) / 6));

  // White flash at T=0
  const flashOpacity = interpolate(
    frame,
    [LAUNCH_FRAME, LAUNCH_FRAME + 2, LAUNCH_FRAME + 8],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // After flash: main text EXPLODES in — scale(0→1.1→1) elastic spring
  const mainTextSpring = spring({
    frame: Math.max(0, frame - LAUNCH_FRAME - 4),
    fps,
    config: { damping: 8, stiffness: 120, mass: 0.8 },
  });
  const mainTextScale = interpolate(mainTextSpring, [0, 0.6, 1], [0, 1.1, 1]);
  const mainTextOpacity = interpolate(mainTextSpring, [0, 0.15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // ParticleField accelerates upward as countdown progresses
  const particleSpeed = interpolate(frame, [0, LAUNCH_FRAME], [0.15, 1.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Red glow intensifies near launch
  const glowIntensity = interpolate(frame, [0, LAUNCH_FRAME], [0.1, 0.65], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Screen shake during countdown
  const shakeX = isLaunched ? 0 : Math.sin(frame * 2.3) * (digitFrame < 4 ? 5 : 0);
  const shakeY = isLaunched ? 0 : Math.cos(frame * 3.1) * (digitFrame < 4 ? 3 : 0);

  const numColor = NUMBER_COLORS[currentNumber] ?? "#ffffff";
  const numGlowColor = NUMBER_GLOW_COLORS[currentNumber] ?? "rgba(255,255,255,0.5)";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#00000a",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      {/* Stars — deterministic */}
      {BG_STARS.map((s) => {
        const tw =
          0.3 + 0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / s.speed));
        return (
          <div
            key={s.id}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              borderRadius: "50%",
              backgroundColor: "#ffffff",
              opacity: s.opacity * tw,
              transform: "translate(-50%,-50%)",
            }}
          />
        );
      })}

      {/* ParticleField that ACCELERATES upward as countdown progresses */}
      <ParticleField
        count={80}
        speedMultiplier={particleSpeed}
        sizeRange={[0.4, 2.0]}
      />

      {/* Background red glow intensifying */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,30,0,${glowIntensity * 0.28}) 0%, transparent 70%)`,
        }}
      />

      {/* Grid — fades in with glow intensity */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(255,68,68,${glowIntensity * 0.07}) 1px, transparent 1px), linear-gradient(90deg, rgba(255,68,68,${glowIntensity * 0.07}) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Countdown bar depletes */}
      {!isLaunched && (
        <>
          <div
            style={{
              position: "absolute",
              bottom: 80,
              left: "10%",
              right: "10%",
              height: 4,
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 2,
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${interpolate(frame, [0, LAUNCH_FRAME], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`,
                background: `linear-gradient(90deg, ${brandColor}, rgba(255,100,0,0.8))`,
                borderRadius: 2,
                boxShadow: `0 0 12px ${brandColor}`,
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              top: 80,
              left: 0,
              right: 0,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: fontSecondary,
                fontSize: 18,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "10px",
                textTransform: "uppercase",
              }}
            >
              T-MINUS LAUNCH SEQUENCE
            </div>
          </div>
        </>
      )}

      {/* Countdown number */}
      {!isLaunched && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: combinedOpacity,
            transform: `scale(${combinedScale})`,
          }}
        >
          {/* Pulsing ring around number */}
          <div
            style={{
              position: "absolute",
              width: 300,
              height: 300,
              borderRadius: "50%",
              border: `3px solid ${numColor}`,
              transform: `scale(${pulseRing})`,
              opacity: pulseOpacity,
              boxShadow: `0 0 30px ${numGlowColor}`,
            }}
          />

          <div
            style={{
              fontFamily: fontPrimary,
              fontSize: currentNumber === 0 ? 220 : 280,
              fontWeight: 900,
              color: numColor,
              letterSpacing: "-8px",
              lineHeight: 1,
              textShadow: `
                0 0 60px ${numGlowColor},
                0 0 120px ${numGlowColor},
                0 0 200px ${numGlowColor}
              `,
              textAlign: "center",
            }}
          >
            {currentNumber === 0 ? "GO!" : currentNumber}
          </div>
        </div>
      )}

      {/* White flash overlay — fills frame for 2 frames */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#ffffff",
          opacity: flashOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Main text after launch — EXPLODES in */}
      {isLaunched && (
        <div
          style={{
            position: "relative",
            textAlign: "center",
            padding: "0 120px",
            opacity: mainTextOpacity,
            transform: `scale(${mainTextScale})`,
          }}
        >
          <div
            style={{
              width: 80,
              height: 4,
              background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
              margin: "0 auto 28px",
              boxShadow: `0 0 20px ${brandColor}`,
            }}
          />
          <GlowText
            text={text}
            fontFamily={fontPrimary}
            fontSize={100}
            fontWeight={900}
            color="#ffffff"
            glowColor="rgba(255,68,68,0.7)"
            glowRadius={80}
            textTransform="uppercase"
            letterSpacing="4px"
          />
          <div
            style={{
              fontFamily: fontSecondary,
              fontSize: 22,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "8px",
              textTransform: "uppercase",
              marginTop: 20,
            }}
          >
            RED SPACE FACTS — CH6
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
