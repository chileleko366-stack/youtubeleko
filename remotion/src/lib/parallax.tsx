import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export type ParallaxLayerProps = {
  children: React.ReactNode;
  /**
   * Depth factor: 1 = foreground (most movement), 3 = background (least).
   * Rate of movement is inversely proportional to depth.
   */
  depth?: number;
  style?: React.CSSProperties;
};

/**
 * Parallax layer — children shift at a rate determined by depth.
 * Stack multiple layers (depth 3 = bg, 2 = mid, 1 = fg) to create
 * Z-space separation inside a composition.
 *
 * Must be placed inside a CameraRig or AbsoluteFill wrapper.
 */
export const ParallaxLayer: React.FC<ParallaxLayerProps> = ({
  children,
  depth = 2,
  style,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const rate = 1 / Math.max(1, depth);
  const maxShiftX = 12 * rate;
  const maxShiftY = 8 * rate;

  const shiftX = interpolate(
    frame,
    [0, durationInFrames / 2, durationInFrames],
    [0, maxShiftX, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  const shiftY = interpolate(
    frame,
    [0, durationInFrames],
    [0, -maxShiftY],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translate(${shiftX}px, ${shiftY}px)`,
        willChange: "transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
