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

const RINGS = [
  { r: 360, speed: 0.006, color: "rgba(180,80,10,0.25)", width: 40 },
  { r: 300, speed: -0.011, color: "rgba(255,100,15,0.38)", width: 28 },
  { r: 240, speed: 0.018, color: "rgba(255,140,30,0.5)", width: 20 },
  { r: 185, speed: -0.028, color: "rgba(255,180,60,0.45)", width: 14 },
  { r: 145, speed: 0.048, color: "rgba(255,210,100,0.4)", width: 9 },
  { r: 112, speed: -0.075, color: "rgba(255,240,160,0.35)", width: 6 },
];

const PHOTON_RING_R = 100;

// Deterministic background stars
const BG_STARS = Array.from({ length: 180 }, (_, i) => ({
  id: i,
  x: random(`bh-x-${i}`) * 100,
  y: random(`bh-y-${i}`) * 100,
  size: random(`bh-s-${i}`) * 1.8 + 0.3,
  opacity: random(`bh-o-${i}`) * 0.5 + 0.1,
  tw: random(`bh-t-${i}`) * 60,
  speed: 30 + random(`bh-sp-${i}`) * 40,
}));

// Hawking radiation particles at event horizon edge
const HAWKING = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  angle: (i / 16) * 360,
  phase: random(`hawk-ph-${i}`) * 40,
  flickerSpeed: 3 + random(`hawk-fs-${i}`) * 5,
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

  // Whole composition slowly zooms in over duration
  const zoomScale = interpolate(frame, [0, 120], [1.0, 1.18], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Black hole reveal spring
  const bhSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 55, mass: 1.6 },
  });
  const bhScale = interpolate(bhSpring, [0, 1], [0, 1]);
  const bhOpacity = interpolate(bhSpring, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Text appears as if "falling in" — slows down near center (ease out)
  const textSpring = spring({
    frame: Math.max(0, frame - 28),
    fps,
    config: { damping: 18, stiffness: 70 },
  });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textY = interpolate(textSpring, [0, 1], [-60, 0]);
  const textScale = interpolate(textSpring, [0, 1], [1.2, 1]);

  // Gravitational lensing subtle scale pulse
  const lensingPulse = 1 + 0.015 * Math.sin((frame * Math.PI) / 40);

  // Background perspective distortion value
  const perspectiveVal = interpolate(bhSpring, [0, 1], [600, 1200]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${zoomScale})`,
        transformOrigin: "50% 50%",
      }}
    >
      {/* Background stars — "bent" appearance via CSS perspective on container */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: perspectiveVal,
        }}
      >
        {BG_STARS.map((s) => {
          const tw =
            0.3 + 0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / s.speed));

          // Stars near center appear distorted (gravitational lensing)
          const distFromCenter = Math.sqrt(
            Math.pow(s.x - 50, 2) + Math.pow(s.y - 50, 2)
          );
          const lensingDistort = distFromCenter < 15
            ? interpolate(distFromCenter, [0, 15], [0.3, 1])
            : 1;

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
                opacity: s.opacity * tw * lensingDistort,
                transform: "translate(-50%,-50%)",
              }}
            />
          );
        })}
      </div>

      {/* Deep space backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 80% at 50% 50%, rgba(8,0,20,0.7) 0%, transparent 80%)",
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
        {/* Outermost glow — very slow, near-transparent, wide */}
        <div
          style={{
            position: "absolute",
            inset: -120,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at 50% 60%, rgba(255,80,0,0.1) 0%, transparent 70%)",
          }}
        />

        {/* Accretion disk glow overlay */}
        <div
          style={{
            position: "absolute",
            inset: -40,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at 50% 65%, rgba(255,140,20,0.15) 0%, transparent 65%)",
          }}
        />

        {/* Rotating accretion rings — progressively faster inward */}
        {RINGS.map((ring, i) => {
          const angle = frame * ring.speed * 360;
          const skewX = 28;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: `${400 - ring.r}px`,
                borderRadius: "50%",
                border: `${ring.width}px solid ${ring.color}`,
                transform: `rotate(${angle}deg) scaleY(0.3) skewX(${
                  i % 2 === 0 ? skewX : -skewX * 0.6
                }deg)`,
                transformOrigin: "center center",
                boxShadow: `0 0 ${ring.width * 2}px ${ring.color}`,
                filter: `blur(${Math.max(0, (RINGS.length - i - 1) * 0.6)}px)`,
              }}
            />
          );
        })}

        {/* Photon ring — bright white/yellow just outside event horizon */}
        <div
          style={{
            position: "absolute",
            inset: `${400 - PHOTON_RING_R - 7}px`,
            borderRadius: "50%",
            border: "3px solid rgba(255,240,180,0.75)",
            boxShadow:
              "0 0 24px rgba(255,230,140,0.7), 0 0 48px rgba(255,200,80,0.35), inset 0 0 12px rgba(255,220,120,0.3)",
          }}
        />

        {/* Event horizon — pure black with white edge glow */}
        <div
          style={{
            position: "absolute",
            inset: `${400 - PHOTON_RING_R + 5}px`,
            borderRadius: "50%",
            backgroundColor: "#000000",
            boxShadow:
              "0 0 40px rgba(0,0,0,1), 0 0 80px rgba(0,0,0,0.9), inset 0 0 30px rgba(0,0,0,1)",
          }}
        />

        {/* Hawking radiation flicker at event horizon edge */}
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
          {HAWKING.map((h) => {
            const radAngle = (h.angle * Math.PI) / 180;
            const r = PHOTON_RING_R - 2;
            const px = Math.cos(radAngle) * r;
            const py = Math.sin(radAngle) * r;
            const flicker = Math.abs(Math.sin(((frame + h.phase) * Math.PI) / h.flickerSpeed));
            return (
              <circle
                key={h.id}
                cx={px}
                cy={py}
                r={2.5}
                fill="#ffffff"
                opacity={flicker * 0.8}
              />
            );
          })}

          {/* Gravitational lensing arcs */}
          {[0, 60, 120, 180, 240, 300].map((angle, i) => {
            const radAngle = (angle * Math.PI) / 180;
            const x1 = Math.cos(radAngle) * 360;
            const y1 = Math.sin(radAngle) * 360;
            const cx1 = Math.cos(radAngle + 0.4) * 170;
            const cy1 = Math.sin(radAngle + 0.4) * 80;
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} Q ${cx1} ${cy1} 0 0`}
                fill="none"
                stroke="rgba(255,220,140,0.06)"
                strokeWidth={1.2}
              />
            );
          })}
        </svg>
      </div>

      {/* Text overlay — appears as if "falling in" from above, slowing near center */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: textOpacity,
          transform: `translateY(${textY}px) scale(${textScale})`,
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
        <GlowText
          text={text}
          fontFamily={fontPrimary}
          fontSize={64}
          fontWeight={900}
          color="#ffffff"
          glowColor="rgba(255,160,40,0.7)"
          glowRadius={50}
          textTransform="uppercase"
          letterSpacing="4px"
        />
        <p
          style={{
            fontFamily: fontSecondary,
            fontSize: 20,
            color: "rgba(255,200,80,0.6)",
            letterSpacing: "5px",
            textTransform: "uppercase",
            margin: "12px 0 0",
          }}
        >
          EVENT HORIZON — SINGULARITY
        </p>
      </div>
    </AbsoluteFill>
  );
};
