import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { easeOutExpo } from "./easing";

export type CameraRigProps = {
  children: React.ReactNode;
  /** Max zoom-in percentage over the full clip duration, default 2 */
  driftPct?: number;
  /** When set, apply a quick push-in at this frame number */
  accentFrame?: number;
  /** Push-in scale boost on accentFrame (extra % above drift), default 1.05 */
  accentScale?: number;
  style?: React.CSSProperties;
};

/**
 * Wraps children with a continuous slow zoom-drift so the frame is never
 * fully static.  Compatible with both 16:9 and 9:16 compositions.
 *
 * Usage: wrap <AbsoluteFill> contents inside <CameraRig>.
 */
export const CameraRig: React.FC<CameraRigProps> = ({
  children,
  driftPct = 2,
  accentFrame,
  accentScale = 1.05,
  style,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Base slow zoom drift
  const driftScale = interpolate(
    frame,
    [0, durationInFrames],
    [1.0, 1.0 + driftPct / 100],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // Gentle horizontal drift (alternates direction mid-clip)
  const driftX = interpolate(
    frame,
    [0, durationInFrames / 2, durationInFrames],
    [0, 4, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  const driftY = interpolate(
    frame,
    [0, durationInFrames],
    [0, -3],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // Optional accent push-in at specific frame
  let accentBoost = 1;
  if (accentFrame !== undefined) {
    const accentProgress = Math.max(0, Math.min(1, (frame - accentFrame) / 8));
    const accentDecay = Math.max(0, Math.min(1, (frame - accentFrame - 8) / 20));
    const boost = easeOutExpo(accentProgress) * (1 - accentDecay);
    accentBoost = 1 + (accentScale - 1) * boost;
  }

  const finalScale = driftScale * accentBoost;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${finalScale}) translate(${driftX}px, ${driftY}px)`,
        transformOrigin: "50% 50%",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
