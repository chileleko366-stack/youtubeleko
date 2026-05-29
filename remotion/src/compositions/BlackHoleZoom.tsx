import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

const RINGS = [
  { r: 340, speed: 0.008, color: "rgba(255,140,20,0.55)", width: 28 },
  { r: 280, speed: -0.014, color: "rgba(255,80,10,0.45)", width: 20 },
  { r: 220, speed: 0.022, color: "rgba(200,50,0,0.5)", width: 14 },
  { r: 170, speed: -0.034, color: "rgba(255,160,40,0.35)", width: 10 },
  { r: 130, speed: 0.05, color: "rgba(255,200,80,0.3)", width: 7 },
  { r: 96, speed: -0.08, color: "rgba(255,220,120,0.25)", width: 5 },
];

const PHOTON_RING_R = 100;

const BG_STARS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.8 + 0.3,
  opacity: Math.random() * 0.5 + 0.1,
  tw: Math.random() * 60,
}));

export const BlackHoleZoom: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Black hole reveal
  const bhSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 55, mass: 1.6 },
  });
  const bhScale = interpolate(bhSpring, [0, 1], [0, 1]);
  const bhOpacity = interpolate(bhSpring, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Text reveal
  const textSpring = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textY = interpolate(textSpring, [0, 1], [30, 0]);

  // Gravitational lensing effect (subtle scale pulse)
  const lensingPulse =
    1 + 0.018 * Math.sin((frame * Math.PI) / 40);

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

      {/* Deep space backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(8,0,20,0.6) 0%, transparent 80%)",
        }}
      />

      {/* Black hole system */}
      <div
        style={{
          position: "relative",
          width: 800,
          height: 800,
          transform: `scale(${bhScale * lensingPulse})`,
          opacity: bhOpacity,
        }}
      >
        {/* Outer glow / accretion disk glow */}
        <div
          style={{
            position: "absolute",
            inset: -80,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at 50% 60%, rgba(255,100,0,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Rotating accretion rings */}
        {RINGS.map((ring, i) => {
          const angle = frame * ring.speed * 360;
          const skewX = 30; // flatten into disk
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: `${400 - ring.r}px`,
                borderRadius: "50%",
                border: `${ring.width}px solid ${ring.color}`,
                transform: `rotate(${angle}deg) scaleY(0.32) skewX(${
                  i % 2 === 0 ? skewX : -skewX * 0.5
                }deg)`,
                transformOrigin: "center center",
                boxShadow: `0 0 ${ring.width * 2}px ${ring.color}`,
                filter: `blur(${Math.max(0, (RINGS.length - i - 1) * 0.5)}px)`,
              }}
            />
          );
        })}

        {/* Photon ring — bright white ring just outside event horizon */}
        <div
          style={{
            position: "absolute",
            inset: `${400 - PHOTON_RING_R - 6}px`,
            borderRadius: "50%",
            border: "4px solid rgba(255,240,200,0.7)",
            boxShadow:
              "0 0 20px rgba(255,230,150,0.6), 0 0 40px rgba(255,200,80,0.3)",
          }}
        />

        {/* Event horizon — pure black circle */}
        <div
          style={{
            position: "absolute",
            inset: `${400 - PHOTON_RING_R + 6}px`,
            borderRadius: "50%",
            backgroundColor: "#000000",
            boxShadow: "0 0 60px rgba(0,0,0,1)",
          }}
        />

        {/* Gravitational lensing arcs (SVG) */}
        <svg
          viewBox="-400 -400 800 800"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
          }}
        >
          {[0, 60, 120, 180, 240, 300].map((angle, i) => {
            const radAngle = (angle * Math.PI) / 180;
            const x1 = Math.cos(radAngle) * 350;
            const y1 = Math.sin(radAngle) * 350;
            const cx1 = Math.cos(radAngle + 0.4) * 180;
            const cy1 = Math.sin(radAngle + 0.4) * 90;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} Q ${cx1} ${cy1} 0 0`}
                fill="none"
                stroke="rgba(255,220,150,0.07)"
                strokeWidth={1}
              />
            );
          })}
        </svg>
      </div>

      {/* Text overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            width: 60,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
            margin: "0 auto 20px",
            boxShadow: `0 0 12px ${brandColor}`,
          }}
        />
        <h2
          style={{
            fontFamily: fontPrimary,
            fontSize: 64,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "4px",
            margin: "0 0 12px",
            textShadow: "0 0 40px rgba(255,255,255,0.2)",
          }}
        >
          {text}
        </h2>
        <p
          style={{
            fontFamily: fontSecondary,
            fontSize: 20,
            color: "rgba(255,200,80,0.6)",
            letterSpacing: "5px",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          EVENT HORIZON — SINGULARITY
        </p>
      </div>
    </AbsoluteFill>
  );
};
