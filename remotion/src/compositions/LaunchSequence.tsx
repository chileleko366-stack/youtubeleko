import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

// Each countdown number occupies ~12 frames, starts at frame 0
const COUNTDOWN_START = 5;
const FRAMES_PER_NUMBER = 14;
const LAUNCH_FRAME = COUNTDOWN_START * FRAMES_PER_NUMBER; // frame 70

const BG_STARS = Array.from({ length: 160 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.4,
  opacity: Math.random() * 0.5 + 0.1,
  tw: Math.random() * 60,
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

  // Which countdown digit are we on?
  const digitIndex = Math.min(
    COUNTDOWN_START,
    Math.floor(frame / FRAMES_PER_NUMBER)
  );
  const digitFrame = frame % FRAMES_PER_NUMBER;
  const currentNumber = COUNTDOWN_START - digitIndex;

  // Each digit slams in and slams out
  const inSpring = spring({
    frame: digitFrame,
    fps,
    config: { damping: 5, stiffness: 300, mass: 0.5 },
  });
  const inScale = interpolate(inSpring, [0, 1], [3.5, 1]);
  const inOpacity = interpolate(inSpring, [0, 0.2], [0, 1], {
    extrapolateRight: "clamp",
  });
  const outOpacity = interpolate(
    digitFrame,
    [FRAMES_PER_NUMBER - 4, FRAMES_PER_NUMBER],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const combinedOpacity = inOpacity * outOpacity;

  // Flash at launch
  const flashOpacity = interpolate(
    frame,
    [LAUNCH_FRAME, LAUNCH_FRAME + 4, LAUNCH_FRAME + 10],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Main text reveal after launch
  const mainTextSpring = spring({
    frame: Math.max(0, frame - LAUNCH_FRAME - 6),
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  const mainTextScale = interpolate(mainTextSpring, [0, 1], [0.5, 1]);
  const mainTextOpacity = interpolate(mainTextSpring, [0, 1], [0, 1]);

  // Countdown bar — fills as we count down (inversely)
  const barProgress = interpolate(
    frame,
    [0, LAUNCH_FRAME],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Screen shake effect during countdown
  const shakeX = isLaunched ? 0 : Math.sin(frame * 2.3) * (digitFrame < 4 ? 4 : 0);
  const shakeY = isLaunched ? 0 : Math.cos(frame * 3.1) * (digitFrame < 4 ? 2 : 0);

  // Red glow intensifies near launch
  const glowIntensity = interpolate(frame, [0, LAUNCH_FRAME], [0.1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translate(${shakeX}px, ${shakeY}px)`,
      }}
    >
      {/* Stars */}
      {BG_STARS.map((s) => {
        const tw =
          0.3 + 0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / 55));
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

      {/* Background red glow that intensifies */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 60% at 50% 50%, rgba(255,30,0,${glowIntensity * 0.3}) 0%, transparent 70%)`,
        }}
      />

      {/* Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(255,68,68,${glowIntensity * 0.08}) 1px, transparent 1px), linear-gradient(90deg, rgba(255,68,68,${glowIntensity * 0.08}) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Countdown bar at bottom */}
      {!isLaunched && (
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
              width: `${barProgress * 100}%`,
              background: `linear-gradient(90deg, ${brandColor}, rgba(255,100,0,0.8))`,
              borderRadius: 2,
              boxShadow: `0 0 12px ${brandColor}`,
            }}
          />
        </div>
      )}

      {/* Countdown label */}
      {!isLaunched && (
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
      )}

      {/* Countdown number */}
      {!isLaunched && (
        <div
          style={{
            position: "absolute",
            opacity: combinedOpacity,
            transform: `scale(${inScale})`,
          }}
        >
          <div
            style={{
              fontFamily: fontPrimary,
              fontSize: currentNumber === 0 ? 220 : 280,
              fontWeight: 900,
              color: currentNumber === 0 ? brandColor : "#ffffff",
              letterSpacing: "-8px",
              lineHeight: 1,
              textShadow:
                currentNumber === 0
                  ? `0 0 80px ${brandColor}, 0 0 160px rgba(255,68,68,0.5)`
                  : "0 0 60px rgba(255,255,255,0.3)",
              textAlign: "center",
            }}
          >
            {currentNumber === 0 ? "GO!" : currentNumber}
          </div>
        </div>
      )}

      {/* Flash overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#ffffff",
          opacity: flashOpacity,
          pointerEvents: "none",
        }}
      />

      {/* Main text after launch */}
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
          <h1
            style={{
              fontFamily: fontPrimary,
              fontSize: 100,
              fontWeight: 900,
              color: "#ffffff",
              textTransform: "uppercase",
              letterSpacing: "4px",
              margin: "0 0 20px",
              lineHeight: 1.05,
              textShadow: `0 0 60px rgba(255,255,255,0.3), 0 0 120px rgba(255,68,68,0.2)`,
            }}
          >
            {text}
          </h1>
          <div
            style={{
              fontFamily: fontSecondary,
              fontSize: 22,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "8px",
              textTransform: "uppercase",
            }}
          >
            RED SPACE FACTS — CH6
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
