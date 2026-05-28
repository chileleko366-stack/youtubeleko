import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpaceSceneType = "stars" | "planet" | "nebula" | "galaxy" | "solar" | "blackhole";

export type SpaceSceneProps = {
  sceneType: SpaceSceneType;
  accentColor: string;
  durationInFrames: number;
};

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  twinkleSpeed: number;
  layer: number; // 0 = close (fast drift), 1 = mid, 2 = far (slow)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seeded(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function generateStars(count: number, w: number, h: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    x: seeded(i * 7.31) * w,
    y: seeded(i * 13.17) * h,
    r: seeded(i * 3.73) * 2.2 + 0.4,
    phase: seeded(i * 11.93) * Math.PI * 2,
    twinkleSpeed: seeded(i * 5.11) * 0.9 + 0.15,
    layer: Math.floor(seeded(i * 2.37) * 3),
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StarField: React.FC<{ stars: Star[]; frame: number; fps: number }> = ({ stars, frame, fps }) => {
  const t = frame / fps;
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
        {stars.map((star, i) => {
          const layerSpeeds = [12, 6, 2]; // px per second per layer
          const speed = layerSpeeds[star.layer] ?? 6;
          const sx = ((star.x + t * speed * 0.3) % width + width) % width;
          const sy = ((star.y + t * speed * 0.1) % height + height) % height;
          const twinkle = Math.sin(t * star.twinkleSpeed + star.phase);
          const opacity = 0.5 + twinkle * 0.3 + star.r * 0.08;
          const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
          // Bright stars get a subtle glow color
          const fill = star.r > 1.8 ? "#e8f0ff" : "#ffffff";
          return <circle key={i} cx={sx} cy={sy} r={star.r} fill={fill} opacity={clampedOpacity} />;
        })}
        {/* A few bright foreground stars with lens flare dots */}
        {[0, 1, 2, 3].map((j) => {
          const bx = seeded(j * 99) * width;
          const by = seeded(j * 77) * height;
          const bpulse = 0.7 + Math.sin(t * 0.4 + j * 2) * 0.3;
          return (
            <g key={`bright-${j}`}>
              <circle cx={bx} cy={by} r={3} fill="#ffffff" opacity={bpulse} />
              <circle cx={bx} cy={by} r={10} fill="#aaccff" opacity={bpulse * 0.15} />
              <circle cx={bx} cy={by} r={20} fill="#aaccff" opacity={bpulse * 0.05} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 60% 80% at 50% 50%, transparent 30%, rgba(1,0,8,0.55) 75%, rgba(2,0,12,0.9) 100%)",
      pointerEvents: "none",
    }}
  />
);

// Planet with 3D radial-gradient sphere + slow surface scroll
const PlanetElement: React.FC<{ frame: number; fps: number; accentColor: string }> = ({
  frame,
  fps,
  accentColor,
}) => {
  const t = frame / fps;
  const { width, height } = useVideoConfig();
  const enter = interpolate(frame, [0, 25], [0.8, 1.0], { extrapolateRight: "clamp" });
  const surfaceOffset = t * 18; // px/s scroll speed for surface bands

  const cx = width * 0.5;
  const cy = height * 0.44;
  const size = Math.min(width, height) * 0.52;

  // Moon orbit
  const moonAngle = t * 0.4; // rad/s
  const moonR = size * 0.72;
  const moonX = cx + Math.cos(moonAngle) * moonR;
  const moonY = cy + Math.sin(moonAngle) * moonR * 0.35;
  const moonZ = Math.sin(moonAngle); // -1 = behind, +1 = in front

  return (
    <AbsoluteFill>
      {/* Atmosphere glow (behind planet) */}
      <div
        style={{
          position: "absolute",
          left: cx - size * 0.62,
          top: cy - size * 0.62,
          width: size * 1.24,
          height: size * 1.24,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, rgba(80,120,255,0.12) 50%, rgba(40,60,200,0.06) 70%, transparent 90%)`,
          transform: `scale(${enter})`,
        }}
      />

      {/* Moon (behind planet when moonZ < 0) */}
      {moonZ < 0 && (
        <div
          style={{
            position: "absolute",
            left: moonX - size * 0.09,
            top: moonY - size * 0.09,
            width: size * 0.18,
            height: size * 0.18,
            borderRadius: "50%",
            background: "radial-gradient(circle at 40% 35%, #c8ccd4, #8890a0 55%, #404458)",
            boxShadow: "0 0 16px 4px rgba(160,170,200,0.18)",
            opacity: 0.88,
          }}
        />
      )}

      {/* Planet sphere */}
      <div
        style={{
          position: "absolute",
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 36% 30%, #6699ee 0%, #2255bb 38%, #0d2260 70%, #040e30 90%)",
          boxShadow: [
            `0 0 ${size * 0.18}px ${size * 0.05}px rgba(80,130,255,0.22)`,
            `0 0 ${size * 0.4}px ${size * 0.1}px rgba(40,70,200,0.10)`,
            `inset ${-size * 0.1}px ${-size * 0.07}px ${size * 0.22}px rgba(0,0,15,0.92)`,
            `inset ${size * 0.05}px ${size * 0.04}px ${size * 0.1}px rgba(120,160,255,0.10)`,
          ].join(","),
          transform: `scale(${enter})`,
          overflow: "hidden",
        }}
      >
        {/* Surface band scroll (creates rotation illusion) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: -surfaceOffset,
            width: `calc(100% + ${surfaceOffset + 120}px)`,
            height: "100%",
            background: `repeating-linear-gradient(
              -18deg,
              transparent 0px,
              rgba(120,170,255,0.06) 55px,
              rgba(80,130,220,0.04) 110px,
              transparent 165px
            )`,
          }}
        />
        {/* Polar ice caps */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "15%",
            width: "70%",
            height: "22%",
            background: "radial-gradient(ellipse at 50% 0%, rgba(200,220,255,0.18) 0%, transparent 80%)",
          }}
        />
      </div>

      {/* Moon (in front of planet when moonZ >= 0) */}
      {moonZ >= 0 && (
        <div
          style={{
            position: "absolute",
            left: moonX - size * 0.09,
            top: moonY - size * 0.09,
            width: size * 0.18,
            height: size * 0.18,
            borderRadius: "50%",
            background: "radial-gradient(circle at 40% 35%, #c8ccd4, #8890a0 55%, #404458)",
            boxShadow: "0 0 16px 4px rgba(160,170,200,0.18)",
            opacity: 0.88,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// Nebula with layered animated gas clouds
const NebulaElement: React.FC<{ frame: number; fps: number; accentColor: string }> = ({
  frame,
  fps,
}) => {
  const t = frame / fps;
  const p1 = 0.82 + Math.sin(t * 0.38) * 0.08;
  const p2 = 0.88 + Math.sin(t * 0.29 + 1.2) * 0.07;
  const p3 = 0.78 + Math.sin(t * 0.45 + 2.4) * 0.10;
  const o1 = 0.16 + Math.sin(t * 0.22) * 0.04;
  const o2 = 0.13 + Math.sin(t * 0.31 + 1) * 0.04;
  const o3 = 0.10 + Math.sin(t * 0.19 + 2) * 0.03;

  return (
    <AbsoluteFill>
      {/* Red-magenta cloud */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: "-15%",
          width: "90%",
          height: "65%",
          background: `radial-gradient(ellipse at 55% 45%, rgba(220,40,40,${o1}) 0%, rgba(180,20,90,${o1 * 0.65}) 38%, transparent 68%)`,
          transform: `scale(${p1}) rotate(-12deg)`,
          filter: "blur(28px)",
        }}
      />
      {/* Blue-purple cloud */}
      <div
        style={{
          position: "absolute",
          top: "28%",
          right: "-10%",
          width: "80%",
          height: "58%",
          background: `radial-gradient(ellipse at 45% 50%, rgba(60,50,240,${o2}) 0%, rgba(130,20,210,${o2 * 0.7}) 42%, transparent 70%)`,
          transform: `scale(${p2}) rotate(9deg)`,
          filter: "blur(24px)",
        }}
      />
      {/* Teal lower cloud */}
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: "15%",
          width: "70%",
          height: "44%",
          background: `radial-gradient(ellipse at 50% 55%, rgba(20,180,195,${o3}) 0%, rgba(20,90,150,${o3 * 0.6}) 48%, transparent 72%)`,
          transform: `scale(${p3}) rotate(4deg)`,
          filter: "blur(34px)",
        }}
      />
      {/* Bright core */}
      <div
        style={{
          position: "absolute",
          top: "33%",
          left: "28%",
          width: "44%",
          height: "34%",
          background: `radial-gradient(ellipse at 50% 50%, rgba(255,200,210,0.09) 0%, transparent 65%)`,
          filter: "blur(18px)",
          transform: `scale(${0.95 + Math.sin(t * 0.55) * 0.06})`,
        }}
      />
    </AbsoluteFill>
  );
};

// Galaxy — elliptical disk with glowing core + spiral arm approximation
const GalaxyElement: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const t = frame / fps;
  const rot = t * 1.8; // deg/s
  const { width, height } = useVideoConfig();
  const cx = width * 0.5;
  const cy = height * 0.48;

  return (
    <AbsoluteFill>
      {/* Outer halo */}
      <div
        style={{
          position: "absolute",
          left: cx - 420,
          top: cy - 160,
          width: 840,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(180,150,255,0.08) 0%, rgba(100,80,200,0.04) 55%, transparent 80%)",
          filter: "blur(30px)",
          transform: `rotate(${-18 + Math.sin(t * 0.08) * 1.5}deg)`,
        }}
      />
      {/* Galaxy disk */}
      <div
        style={{
          position: "absolute",
          left: cx - 360,
          top: cy - 130,
          width: 720,
          height: 260,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,245,200,0.35) 0%, rgba(220,190,255,0.18) 25%, rgba(120,90,200,0.08) 55%, transparent 78%)",
          filter: "blur(8px)",
          transform: `rotate(${rot * 0.15}deg)`,
        }}
      >
        {/* Spiral arms via conic gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `conic-gradient(
              from ${rot}deg at 50% 50%,
              transparent 0deg,
              rgba(210,190,255,0.12) 35deg,
              transparent 70deg,
              rgba(255,240,200,0.08) 105deg,
              transparent 140deg,
              rgba(210,190,255,0.10) 175deg,
              transparent 210deg,
              rgba(255,240,200,0.07) 245deg,
              transparent 280deg,
              rgba(210,190,255,0.09) 315deg,
              transparent 350deg
            )`,
            filter: "blur(14px)",
          }}
        />
      </div>
      {/* Bright galactic core */}
      <div
        style={{
          position: "absolute",
          left: cx - 28,
          top: cy - 22,
          width: 56,
          height: 44,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,255,230,0.75) 0%, rgba(255,220,150,0.4) 40%, transparent 75%)",
          filter: "blur(9px)",
          transform: `scale(${0.9 + Math.sin(t * 0.45) * 0.08})`,
        }}
      />
    </AbsoluteFill>
  );
};

// Solar — sun with pulsing corona + lens flare
const SolarElement: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const t = frame / fps;
  const pulse = 1 + Math.sin(t * 0.55) * 0.028;
  const { width, height } = useVideoConfig();
  const cx = width * 0.5;
  const cy = height * 0.38;
  const r = 190;

  return (
    <AbsoluteFill>
      {/* Outer corona halo */}
      <div
        style={{
          position: "absolute",
          left: cx - r * 2.2,
          top: cy - r * 2.2,
          width: r * 4.4,
          height: r * 4.4,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,190,40,0.04) 35%, rgba(255,130,10,0.08) 58%, transparent 78%)",
          transform: `scale(${pulse * 1.15})`,
          filter: "blur(22px)",
        }}
      />
      {/* Inner corona */}
      <div
        style={{
          position: "absolute",
          left: cx - r * 1.5,
          top: cy - r * 1.5,
          width: r * 3,
          height: r * 3,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,220,80,0.08) 40%, rgba(255,160,20,0.12) 62%, transparent 80%)",
          transform: `scale(${pulse})`,
          filter: "blur(12px)",
        }}
      />
      {/* Sun surface */}
      <div
        style={{
          position: "absolute",
          left: cx - r,
          top: cy - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 38% 32%, #fff8d0 0%, #ffe040 18%, #ff9800 52%, #cc4400 82%, #7a1a00 100%)",
          boxShadow: [
            `0 0 ${r * 0.6}px ${r * 0.2}px rgba(255,180,0,0.35)`,
            `0 0 ${r * 1.2}px ${r * 0.4}px rgba(255,120,0,0.18)`,
            `inset ${-r * 0.15}px ${-r * 0.12}px ${r * 0.4}px rgba(150,60,0,0.55)`,
          ].join(","),
          transform: `scale(${pulse})`,
          overflow: "hidden",
        }}
      >
        {/* Surface convection cells */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(circle at ${32 + Math.sin(t * 0.18) * 10}% ${42 + Math.cos(t * 0.14) * 9}%, rgba(255,255,180,0.22) 0%, transparent 28%),
              radial-gradient(circle at ${62 + Math.cos(t * 0.22) * 7}% ${35 + Math.sin(t * 0.19) * 8}%, rgba(255,240,100,0.16) 0%, transparent 22%),
              radial-gradient(circle at ${48 + Math.sin(t * 0.28) * 12}% ${65 + Math.cos(t * 0.16) * 6}%, rgba(255,200,50,0.12) 0%, transparent 20%)
            `,
          }}
        />
      </div>
      {/* Solar prominence (bottom arc) */}
      <div
        style={{
          position: "absolute",
          left: cx + r * 0.4,
          top: cy + r * 0.55,
          width: r * 0.5,
          height: r * 0.5,
          borderRadius: "50% 50% 0 80%",
          background: "radial-gradient(ellipse at 60% 40%, rgba(255,120,20,0.3) 0%, transparent 70%)",
          filter: "blur(6px)",
          transform: `rotate(${30 + Math.sin(t * 0.3) * 8}deg) scale(${0.85 + Math.sin(t * 0.5 + 1) * 0.15})`,
        }}
      />
    </AbsoluteFill>
  );
};

// Black hole — dark center with bright accretion disk
const BlackholeElement: React.FC<{ frame: number; fps: number; accentColor: string }> = ({
  frame,
  fps,
  accentColor,
}) => {
  const t = frame / fps;
  const { width, height } = useVideoConfig();
  const cx = width * 0.5;
  const cy = height * 0.44;
  const r = 150;
  const diskRot = t * 25; // fast disk rotation

  return (
    <AbsoluteFill>
      {/* Gravitational lensing glow */}
      <div
        style={{
          position: "absolute",
          left: cx - r * 2,
          top: cy - r * 1.2,
          width: r * 4,
          height: r * 2.4,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, transparent 35%, rgba(255,120,30,0.06) 55%, rgba(255,80,10,0.10) 68%, transparent 80%)`,
          filter: "blur(10px)",
        }}
      />
      {/* Accretion disk (elliptical ring, fast rotation) */}
      <div
        style={{
          position: "absolute",
          left: cx - r * 1.8,
          top: cy - r * 0.55,
          width: r * 3.6,
          height: r * 1.1,
          borderRadius: "50%",
          background: `conic-gradient(
            from ${diskRot}deg at 50% 50%,
            rgba(255,80,0,0.0) 0deg,
            rgba(255,160,40,0.40) 20deg,
            rgba(255,220,80,0.60) 45deg,
            rgba(255,180,60,0.45) 70deg,
            rgba(255,80,0,0.10) 120deg,
            rgba(255,80,0,0.0) 180deg,
            rgba(100,60,200,0.08) 200deg,
            rgba(160,80,255,0.20) 220deg,
            rgba(200,100,255,0.28) 240deg,
            rgba(160,80,255,0.18) 260deg,
            rgba(100,60,200,0.05) 300deg,
            rgba(255,80,0,0.0) 360deg
          )`,
          filter: "blur(4px)",
        }}
      />
      {/* Event horizon (pure black circle) */}
      <div
        style={{
          position: "absolute",
          left: cx - r,
          top: cy - r,
          width: r * 2,
          height: r * 2,
          borderRadius: "50%",
          backgroundColor: "#000000",
          boxShadow: `0 0 ${r * 0.5}px ${r * 0.15}px rgba(0,0,0,0.95)`,
        }}
      />
      {/* Photon ring — thin bright ring at event horizon edge */}
      <div
        style={{
          position: "absolute",
          left: cx - r - 5,
          top: cy - r - 5,
          width: r * 2 + 10,
          height: r * 2 + 10,
          borderRadius: "50%",
          border: `3px solid rgba(255,200,80,${0.55 + Math.sin(t * 1.2) * 0.2})`,
          boxShadow: `0 0 14px 3px rgba(255,160,30,0.30)`,
        }}
      />
    </AbsoluteFill>
  );
};

// ─── Main composition ─────────────────────────────────────────────────────────

export const SpaceScene: React.FC<SpaceSceneProps> = ({
  sceneType = "stars",
  accentColor = "#ff2222",
  durationInFrames = 90,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const stars = useMemo(() => generateStars(280, width, height), [width, height]);

  // Subtle background depth gradient (slightly lighter at center top)
  const bgGradient =
    "radial-gradient(ellipse 70% 50% at 50% 20%, #0a0128 0%, #04000f 60%, #020008 100%)";

  return (
    <AbsoluteFill style={{ background: bgGradient, overflow: "hidden" }}>
      {/* Layer 1: Animated star field (always present) */}
      <StarField stars={stars} frame={frame} fps={fps} />

      {/* Layer 2: Scene-specific element */}
      {sceneType === "planet" && (
        <PlanetElement frame={frame} fps={fps} accentColor={accentColor} />
      )}
      {sceneType === "nebula" && (
        <NebulaElement frame={frame} fps={fps} accentColor={accentColor} />
      )}
      {sceneType === "galaxy" && <GalaxyElement frame={frame} fps={fps} />}
      {sceneType === "solar" && <SolarElement frame={frame} fps={fps} />}
      {sceneType === "blackhole" && (
        <BlackholeElement frame={frame} fps={fps} accentColor={accentColor} />
      )}
      {/* "stars" type: just the star field above, no extra element */}

      {/* Layer 3: Cinematic vignette (always present) */}
      <Vignette />
    </AbsoluteFill>
  );
};
