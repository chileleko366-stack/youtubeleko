import React from "react";
import { interpolate, random, useCurrentFrame } from "remotion";

export type ChromaticAberrationProps = {
  children: React.ReactNode;
  /** 0–1 intensity (0 = off, 1 = full glitch) */
  intensity?: number;
  /** Seed for deterministic randomness */
  seed?: string;
  style?: React.CSSProperties;
};

/**
 * Chromatic aberration / RGB-split effect.
 * Splits the rendered children into R/G/B channels offset slightly in
 * different directions.  Used for "illusion / distortion / classified" beats.
 *
 * Keeps render cost low: three absolutely-positioned divs with CSS mix-blend-mode.
 */
export const ChromaticAberration: React.FC<ChromaticAberrationProps> = ({
  children,
  intensity = 0.5,
  seed = "glitch",
  style,
}) => {
  const frame = useCurrentFrame();

  if (intensity <= 0) {
    return (
      <div style={{ position: "relative", ...style }}>{children}</div>
    );
  }

  const maxOffset = intensity * 6;

  // Jitter: occasional random slice-style displacement
  const jitterCycle = Math.floor(frame / 4);
  const jitterOn = random(`${seed}-jitter-${jitterCycle}`) > 0.65;
  const jitterY = jitterOn
    ? interpolate(random(`${seed}-jy-${jitterCycle}`), [0, 1], [-8, 8])
    : 0;

  const rX = maxOffset * 0.8;
  const bX = -maxOffset * 0.6;
  const rY = maxOffset * 0.2 + jitterY * 0.3;
  const bY = -maxOffset * 0.15 + jitterY * 0.2;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Red channel offset */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${rX}px, ${rY}px)`,
          mixBlendMode: "screen",
          filter: "saturate(3) hue-rotate(0deg)",
          opacity: 0.6,
        }}
      >
        {children}
      </div>

      {/* Blue channel offset */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${bX}px, ${bY}px)`,
          mixBlendMode: "screen",
          filter: "saturate(3) hue-rotate(240deg)",
          opacity: 0.6,
        }}
      >
        {children}
      </div>

      {/* Base (normal) layer */}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
};

export type GlitchProps = {
  children: React.ReactNode;
  /** Frames at which the glitch fires (e.g. beat frames) */
  triggerFrames?: number[];
  /** Duration in frames each glitch lasts, default 8 */
  glitchDuration?: number;
  /** Max RGB offset in px, default 8 */
  maxOffset?: number;
  style?: React.CSSProperties;
};

/**
 * One-shot glitch bursts at specified trigger frames.
 * Falls back to no-op when triggerFrames is empty.
 */
export const Glitch: React.FC<GlitchProps> = ({
  children,
  triggerFrames = [],
  glitchDuration = 8,
  maxOffset = 8,
  style,
}) => {
  const frame = useCurrentFrame();

  // Find the closest active trigger
  const activeTrigger = triggerFrames.find(
    (tf) => frame >= tf && frame < tf + glitchDuration
  );

  if (activeTrigger === undefined) {
    return <div style={{ position: "relative", ...style }}>{children}</div>;
  }

  const progress = (frame - activeTrigger) / glitchDuration;
  const decayedIntensity = Math.max(0, 1 - progress * progress);

  return (
    <ChromaticAberration
      intensity={decayedIntensity}
      seed={`glitch-${activeTrigger}`}
      style={style}
    >
      {children}
    </ChromaticAberration>
  );
};
