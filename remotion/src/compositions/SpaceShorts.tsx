import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type SpaceShortsProps = {
  factCards: Array<{ text: string; subtitle?: string }>;
  brandColor: string;
  backgroundColor: string;
  fontPrimary: string;
  durationInFrames: number;
};

const FALLBACK_CARDS = [
  { text: "Space is expanding faster than light", subtitle: "" },
  { text: "A teaspoon of neutron star weighs 1 billion tons", subtitle: "" },
  { text: "The observable universe is 93 billion light-years wide", subtitle: "" },
  { text: "Follow for a space fact every day 🚀", subtitle: "#SpaceFacts" },
];

// Deterministic star field — computed once, not per frame
const STARS = Array.from({ length: 80 }, (_, i) => ({
  x: ((i * 37 + 13) % 100),
  y: ((i * 61 + 7) % 100),
  size: ((i * 17) % 3) + 1,
  opacity: (((i * 7) % 8) + 2) / 12,
}));

export const SpaceShorts: React.FC<SpaceShortsProps> = ({
  factCards = FALLBACK_CARDS,
  brandColor = "#ff4444",
  backgroundColor = "#03010a",
  fontPrimary = "Arial",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const cards = factCards.length > 0 ? factCards : FALLBACK_CARDS;
  const framesPerCard = Math.floor(durationInFrames / cards.length);
  const cardIndex = Math.min(Math.floor(frame / framesPerCard), cards.length - 1);
  const frameInCard = frame - cardIndex * framesPerCard;

  const card = cards[cardIndex];

  const enter = spring({ frame: frameInCard, fps, config: { damping: 22, stiffness: 110 } });

  const exitStart = framesPerCard - 12;
  const exitT = interpolate(frameInCard, [exitStart, framesPerCard], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = Math.max(0, Math.min(enter, 1 - exitT));
  const translateY = interpolate(enter, [0, 1], [70, 0]);

  const totalProgress = frame / durationInFrames;
  const cardProgress = Math.min(frameInCard / framesPerCard, 1);

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      {/* Star field */}
      {STARS.map((star, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            opacity: star.opacity,
          }}
        />
      ))}

      {/* Top progress bar */}
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 48,
          right: 48,
          height: 5,
          backgroundColor: "rgba(255,255,255,0.15)",
          borderRadius: 3,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${totalProgress * 100}%`,
            backgroundColor: brandColor,
            borderRadius: 3,
          }}
        />
      </div>

      {/* Card indicator dots */}
      <div
        style={{
          position: "absolute",
          top: 88,
          left: 0,
          right: 0,
          display: "flex",
          gap: 10,
          justifyContent: "center",
        }}
      >
        {cards.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === cardIndex ? 28 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i <= cardIndex ? brandColor : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </div>

      {/* Main card content */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "28%",
          padding: "0 64px",
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {/* Channel label */}
        <div
          style={{
            fontFamily: fontPrimary,
            fontSize: 28,
            fontWeight: 700,
            color: brandColor,
            letterSpacing: 5,
            textTransform: "uppercase",
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          RED SPACE FACTS
        </div>

        {/* Accent bar */}
        <div
          style={{
            width: 72,
            height: 4,
            backgroundColor: brandColor,
            margin: "0 auto 44px",
            borderRadius: 2,
          }}
        />

        {/* Fact text */}
        <p
          style={{
            fontFamily: fontPrimary,
            fontSize: card.text.length > 70 ? 48 : card.text.length > 50 ? 56 : 64,
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1.2,
            margin: 0,
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "-0.5px",
          }}
        >
          {card.text}
        </p>

        {/* Subtitle */}
        {card.subtitle ? (
          <p
            style={{
              fontFamily: fontPrimary,
              fontSize: 30,
              fontWeight: 400,
              color: "rgba(255,255,255,0.55)",
              textAlign: "center",
              margin: "28px 0 0",
            }}
          >
            {card.subtitle}
          </p>
        ) : null}
      </div>

      {/* Per-card timer bar at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 96,
          left: 48,
          right: 48,
          height: 3,
          backgroundColor: "rgba(255,255,255,0.1)",
          borderRadius: 2,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${cardProgress * 100}%`,
            backgroundColor: "rgba(255,255,255,0.4)",
            borderRadius: 2,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
