import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

const LEFT_STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: Math.random() * 50,
  y: Math.random() * 100,
  size: Math.random() * 1.8 + 0.3,
  opacity: Math.random() * 0.5 + 0.15,
  tw: Math.random() * 60,
}));

const RIGHT_STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: 50 + Math.random() * 50,
  y: Math.random() * 100,
  size: Math.random() * 1.8 + 0.3,
  opacity: Math.random() * 0.5 + 0.15,
  tw: Math.random() * 60,
}));

export const SpaceSplitScreen: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftLabel = bullets?.[0] ?? "BEFORE";
  const rightLabel = bullets?.[1] ?? "AFTER";
  const leftSub = bullets?.[2] ?? "THE PAST";
  const rightSub = bullets?.[3] ?? "THE FUTURE";

  // Left side fades in from left
  const leftSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const leftOpacity = interpolate(leftSpring, [0, 1], [0, 1]);
  const leftX = interpolate(leftSpring, [0, 1], [-80, 0]);

  // Right side fades in from right
  const rightSpring = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const rightOpacity = interpolate(rightSpring, [0, 1], [0, 1]);
  const rightX = interpolate(rightSpring, [0, 1], [80, 0]);

  // Center red divider line draws from top
  const lineSpring = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 20, stiffness: 70 },
  });
  const lineHeight = interpolate(lineSpring, [0, 1], [0, 100]);

  // Title fades in
  const titleSpring = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  const titleY = interpolate(titleSpring, [0, 1], [20, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        overflow: "hidden",
      }}
    >
      {/* Left side stars */}
      {LEFT_STARS.map((s) => {
        const tw =
          0.3 + 0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / 55));
        return (
          <div
            key={`l${s.id}`}
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

      {/* Right side stars */}
      {RIGHT_STARS.map((s) => {
        const tw =
          0.3 + 0.7 * Math.abs(Math.sin(((frame + s.tw) * Math.PI) / 55));
        return (
          <div
            key={`r${s.id}`}
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

      {/* Left panel gradient */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          background:
            "radial-gradient(ellipse 100% 80% at 30% 50%, rgba(0,20,80,0.4) 0%, transparent 80%)",
          opacity: leftOpacity,
          transform: `translateX(${leftX}px)`,
        }}
      />

      {/* Right panel gradient */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "50%",
          height: "100%",
          background:
            "radial-gradient(ellipse 100% 80% at 70% 50%, rgba(60,0,100,0.4) 0%, transparent 80%)",
          opacity: rightOpacity,
          transform: `translateX(${rightX}px)`,
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

      {/* Left content */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "50%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: leftOpacity,
          transform: `translateX(${leftX}px)`,
        }}
      >
        <div style={{ textAlign: "center", padding: "0 60px" }}>
          <div
            style={{
              fontFamily: fontSecondary,
              fontSize: 16,
              color: "rgba(100,150,255,0.7)",
              letterSpacing: "8px",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            {leftSub}
          </div>
          <div
            style={{
              fontFamily: fontPrimary,
              fontSize: 88,
              fontWeight: 900,
              color: "#aaccff",
              textTransform: "uppercase",
              letterSpacing: "4px",
              lineHeight: 1.05,
              textShadow: "0 0 40px rgba(100,150,255,0.3)",
            }}
          >
            {leftLabel}
          </div>
          <div
            style={{
              width: 60,
              height: 3,
              backgroundColor: "rgba(100,150,255,0.5)",
              margin: "24px auto 0",
              boxShadow: "0 0 12px rgba(100,150,255,0.4)",
            }}
          />
        </div>
      </div>

      {/* Right content */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "50%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: rightOpacity,
          transform: `translateX(${rightX}px)`,
        }}
      >
        <div style={{ textAlign: "center", padding: "0 60px" }}>
          <div
            style={{
              fontFamily: fontSecondary,
              fontSize: 16,
              color: "rgba(255,100,100,0.7)",
              letterSpacing: "8px",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            {rightSub}
          </div>
          <div
            style={{
              fontFamily: fontPrimary,
              fontSize: 88,
              fontWeight: 900,
              color: "#ff8888",
              textTransform: "uppercase",
              letterSpacing: "4px",
              lineHeight: 1.05,
              textShadow: `0 0 40px rgba(255,68,68,0.35)`,
            }}
          >
            {rightLabel}
          </div>
          <div
            style={{
              width: 60,
              height: 3,
              backgroundColor: brandColor,
              margin: "24px auto 0",
              boxShadow: `0 0 12px ${brandColor}`,
            }}
          />
        </div>
      </div>

      {/* Center red divider line */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: 4,
          height: `${lineHeight}%`,
          background: `linear-gradient(180deg, transparent, ${brandColor} 10%, ${brandColor} 90%, transparent)`,
          transform: "translateX(-50%)",
          boxShadow: `0 0 20px ${brandColor}, 0 0 40px rgba(255,68,68,0.3)`,
        }}
      />

      {/* Center dot on line */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: brandColor,
          boxShadow: `0 0 20px ${brandColor}, 0 0 40px rgba(255,68,68,0.5)`,
          opacity: lineHeight > 50 ? 1 : 0,
        }}
      />

      {/* Bottom title */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <h2
          style={{
            fontFamily: fontPrimary,
            fontSize: 44,
            fontWeight: 900,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "6px",
            margin: "0 0 8px",
            textShadow: `0 0 20px rgba(255,68,68,0.2)`,
          }}
        >
          {text}
        </h2>
        <div
          style={{
            fontFamily: fontSecondary,
            fontSize: 16,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "5px",
            textTransform: "uppercase",
          }}
        >
          RED SPACE FACTS — CH6
        </div>
      </div>
    </AbsoluteFill>
  );
};
