import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

const BG_STARS = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.8 + 0.3,
  opacity: Math.random() * 0.45 + 0.1,
  tw: Math.random() * 55,
}));

export const NebulaBulletList: React.FC<CompositionProps> = ({
  text,
  bullets,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const items = bullets && bullets.length > 0 ? bullets : [text];

  // Title
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [-28, 0]);

  // Title underline
  const lineSpring = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 20, stiffness: 80 },
  });
  const lineWidth = interpolate(lineSpring, [0, 1], [0, 100]);

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
          0.3 + 0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / 52));
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

      {/* Nebula gradient — deep purple/blue */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 70% 90% at 15% 50%, rgba(60,0,120,0.4) 0%, transparent 65%),
            radial-gradient(ellipse 60% 70% at 85% 50%, rgba(0,20,100,0.35) 0%, transparent 65%),
            radial-gradient(ellipse 80% 50% at 50% 80%, rgba(20,0,60,0.3) 0%, transparent 70%)
          `,
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 30%, rgba(0,0,8,0.8) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Left accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          background: `linear-gradient(180deg, transparent, ${brandColor} 30%, ${brandColor} 70%, transparent)`,
          boxShadow: `0 0 20px ${brandColor}`,
          opacity: titleOpacity,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 1300,
          padding: "0 140px",
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontFamily: fontPrimary,
            fontSize: 64,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "4px",
            margin: "0 0 12px",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textShadow: `0 0 30px rgba(255,68,68,0.25)`,
          }}
        >
          {text}
        </h1>

        {/* Underline */}
        <div
          style={{
            height: 3,
            width: `${lineWidth}%`,
            background: `linear-gradient(90deg, ${brandColor}, rgba(120,40,255,0.5))`,
            marginBottom: 44,
            borderRadius: 2,
            boxShadow: `0 0 12px ${brandColor}`,
          }}
        />

        {/* Bullet items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {items.map((item, i) => {
            const delay = 14 + i * 8;
            const bSpring = spring({
              frame: Math.max(0, frame - delay),
              fps,
              config: { damping: 16, stiffness: 110 },
            });
            const bOpacity = interpolate(bSpring, [0, 1], [0, 1]);
            const bX = interpolate(bSpring, [0, 1], [-60, 0]);

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 24,
                  opacity: bOpacity,
                  transform: `translateX(${bX}px)`,
                }}
              >
                {/* Arrow bullet */}
                <div
                  style={{
                    flexShrink: 0,
                    marginTop: 8,
                    width: 0,
                    height: 0,
                    borderTop: "10px solid transparent",
                    borderBottom: "10px solid transparent",
                    borderLeft: `16px solid ${brandColor}`,
                    filter: `drop-shadow(0 0 6px ${brandColor})`,
                  }}
                />

                {/* Bullet number + text */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                  <span
                    style={{
                      fontFamily: fontPrimary,
                      fontSize: 28,
                      color: brandColor,
                      opacity: 0.7,
                      minWidth: 32,
                      letterSpacing: "2px",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontFamily: fontSecondary,
                      fontSize: 30,
                      fontWeight: 400,
                      color: "rgba(255,255,255,0.9)",
                      lineHeight: 1.45,
                      letterSpacing: "0.3px",
                    }}
                  >
                    {item}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
