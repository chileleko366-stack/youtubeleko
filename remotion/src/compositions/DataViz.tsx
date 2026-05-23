import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";

interface Bar {
  label: string;
  value: number;
}

export const DataViz: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  fontSecondary,
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 100 },
  });

  // Parse bullets or text into bar data
  const rawItems = bullets && bullets.length > 0 ? bullets : text.split(/[,;]/).map((s) => s.trim());
  const bars: Bar[] = rawItems.slice(0, 6).map((item, i) => {
    // Try to extract a number from the item
    const match = item.match(/(\d+(?:\.\d+)?)/);
    const value = match ? parseFloat(match[1]) : (i + 1) * 15;
    const label = item.replace(/^\d+(?:\.\d+)?%?\s*[-:]?\s*/, "").trim() || item;
    return { label: label.substring(0, 30), value };
  });

  const maxValue = Math.max(...bars.map((b) => b.value), 1);

  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [-20, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        padding: "80px 120px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {/* Title */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          marginBottom: 60,
        }}
      >
        <div
          style={{
            height: 4,
            width: 60,
            backgroundColor: brandColor,
            marginBottom: 20,
            borderRadius: 2,
          }}
        />
        <h1
          style={{
            fontFamily: fontPrimary,
            fontSize: 48,
            fontWeight: 900,
            color: "#ffffff",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          {text.length > 60 ? text.substring(0, 60) + "..." : text}
        </h1>
      </div>

      {/* Bar chart */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {bars.map((bar, i) => {
          const barProgress = spring({
            frame: frame - i * 6,
            fps,
            config: { damping: 20, stiffness: 80 },
          });
          const barWidth = interpolate(barProgress, [0, 1], [0, (bar.value / maxValue) * 100]);
          const barOpacity = interpolate(barProgress, [0, 0.2], [0, 1]);

          return (
            <div key={i} style={{ opacity: barOpacity }}>
              <div
                style={{
                  fontFamily: fontSecondary,
                  fontSize: 24,
                  color: "#cccccc",
                  marginBottom: 8,
                }}
              >
                {bar.label}
              </div>
              <div
                style={{
                  height: 40,
                  backgroundColor: "#ffffff11",
                  borderRadius: 4,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${barWidth}%`,
                    backgroundColor: brandColor,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: fontPrimary,
                      fontSize: 20,
                      fontWeight: 900,
                      color: "#000000",
                    }}
                  >
                    {bar.value}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
