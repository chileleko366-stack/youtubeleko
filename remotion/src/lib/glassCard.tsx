import React from "react";

export type GlassCardProps = {
  children: React.ReactNode;
  brandColor?: string;
  borderRadius?: number;
  opacity?: number;
  padding?: number | string;
  style?: React.CSSProperties;
};

/**
 * Glassmorphism card: frosted backdrop-filter blur, translucent border,
 * soft shadow, rounded corners.  Consistent with the modern-tech aesthetic
 * used across StatsBanner, DataViz, Quote, and BulletList.
 *
 * Note: backdrop-filter renders in Remotion via Chromium — no polyfill needed.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  brandColor = "#ffffff",
  borderRadius = 20,
  opacity = 0.12,
  padding = 40,
  style,
}) => {
  return (
    <div
      style={{
        background: `rgba(255, 255, 255, ${opacity})`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid rgba(255, 255, 255, 0.18)`,
        borderRadius,
        boxShadow: `0 8px 48px rgba(0, 0, 0, 0.45), 0 0 0 1px ${brandColor}22`,
        padding,
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Subtle inner highlight at top edge */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
          borderRadius: `${borderRadius}px ${borderRadius}px 0 0`,
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );
};
