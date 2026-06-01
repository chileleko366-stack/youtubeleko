import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CompositionProps } from "../Root";
import { GradientBg } from "../lib/gradientBg";
import { LightLeak } from "../lib/lightLeak";
import { ParticleField } from "../lib/particles";
import { Scanlines } from "../lib/scanlines";
import { easeOutExpo, easeOutElastic } from "../lib/easing";

const WORD_ANIM_FRAMES = 12;
const SCALE_ANIM_FRAMES = 18;
const WORD_STAGGER = 3;
const FADE_OUT_FRAMES = 6;
const DEFAULT_ACCENT_WARN = "#ff6b35";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function chunkWords(words: string[], maxPerGroup: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += maxPerGroup) {
    chunks.push(words.slice(i, i + maxPerGroup));
  }
  return chunks;
}

function autoFontSize(group: string[], isVertical: boolean): number {
  const totalChars = group.join("").length;
  const maxWordLen = Math.max(...group.map((w) => w.length));
  const base = isVertical ? 80 : 96;
  const reduction =
    Math.max(0, maxWordLen - 5) * 4 + Math.max(0, totalChars - 10) * 1.5;
  return Math.max(40, Math.min(base, base - reduction));
}

function isWordHighlighted(word: string, highlightWords: string[]): boolean {
  const clean = word.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return highlightWords.some(
    (hw) => hw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === clean
  );
}

export const TextReveal: React.FC<CompositionProps> = ({
  text,
  brandColor,
  backgroundColor,
  fontPrimary,
  highlightWords = [],
  accentWarn = DEFAULT_ACCENT_WARN,
  maxWordsPerGroup = 3,
  visualSpec,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  // Merge highlight words from both prop and visualSpec
  const allHighlightWords = [
    ...highlightWords,
    ...(visualSpec?.highlightWords ?? []),
    ...(visualSpec?.kineticWords ?? []),
  ];

  const words = text.split(/\s+/).filter(Boolean);
  const groups = chunkWords(words, maxWordsPerGroup);
  const numGroups = Math.max(1, groups.length);
  const chunkFrames = durationInFrames / numGroups;

  const isVertical = height > width;

  // Camera drift — slow zoom + gentle pan
  const driftScale = interpolate(
    frame,
    [0, durationInFrames],
    [1.0, 1.02],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const driftX = interpolate(
    frame,
    [0, durationInFrames],
    [0, 6],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const driftY = interpolate(
    frame,
    [0, durationInFrames],
    [0, -4],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // Accent line entrance
  const lineT = clamp01(frame / 10);
  const lineWidthEased = interpolate(easeOutExpo(lineT), [0, 1], [0, 100]);

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      <GradientBg
        colors={[backgroundColor, `${brandColor}18`, backgroundColor]}
        angle={145}
        animate
      />

      <ParticleField
        count={20}
        color={brandColor}
        opacity={0.15}
        speed={0.6}
        size={[1, 2]}
      />

      {/* Camera drift wrapper */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${driftScale}) translate(${driftX}px, ${driftY}px)`,
          transformOrigin: "50% 50%",
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "8%",
            height: 4,
            width: `${lineWidthEased}%`,
            background: `linear-gradient(90deg, ${brandColor}, ${brandColor}88)`,
            borderRadius: 2,
            marginTop: isVertical ? -180 : -120,
            boxShadow: `0 0 16px ${brandColor}99`,
          }}
        />

        {/* Kinetic word groups */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: isVertical ? "5%" : "8%",
            right: isVertical ? "5%" : "8%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: isVertical ? "center" : "flex-start",
            justifyContent: "center",
          }}
        >
          {groups.map((group, groupIdx) => {
            const groupStart = groupIdx * chunkFrames;
            const groupEnd = groupStart + chunkFrames;
            const isActive = frame >= groupStart && frame < groupEnd;

            if (!isActive) return null;

            const framesIntoGroup = frame - groupStart;
            const fontSize = autoFontSize(group, isVertical);

            // Fade out near end of chunk (only when more groups follow)
            const hasFadeOut = groupIdx < numGroups - 1;
            const fadeOutStart = chunkFrames - FADE_OUT_FRAMES;
            const fadeOutT = hasFadeOut
              ? clamp01((framesIntoGroup - fadeOutStart) / FADE_OUT_FRAMES)
              : 0;
            const groupOpacity = 1 - easeOutExpo(fadeOutT);

            return (
              <div
                key={groupIdx}
                style={{
                  display: "flex",
                  flexWrap: "nowrap",
                  gap: "0.2em",
                  opacity: groupOpacity,
                  alignItems: "baseline",
                }}
              >
                {group.map((word, wordIdx) => {
                  const delay = wordIdx * WORD_STAGGER;
                  const wordT = clamp01(
                    (framesIntoGroup - delay) / WORD_ANIM_FRAMES
                  );
                  const wordEased = easeOutExpo(wordT);
                  const wordOpacity = wordEased;
                  const wordY = interpolate(wordEased, [0, 1], [8, 0]);

                  // Scale pop: 1.1 → 1.0 via easeOutElastic
                  const scaleT = clamp01(
                    (framesIntoGroup - delay) / SCALE_ANIM_FRAMES
                  );
                  const wordScale = 1.1 - 0.1 * easeOutElastic(scaleT);

                  // Velocity-based motion blur during fast entrance
                  const motionBlur = interpolate(wordT, [0, 0.3], [3, 0], {
                    extrapolateRight: "clamp",
                    extrapolateLeft: "clamp",
                  });

                  const isHighlight = isWordHighlighted(word, allHighlightWords);

                  return (
                    <span
                      key={wordIdx}
                      style={{
                        display: "inline-block",
                        fontFamily: fontPrimary,
                        fontSize,
                        fontWeight: isHighlight ? 900 : 800,
                        color: isHighlight ? accentWarn : "#ffffff",
                        textTransform: "uppercase",
                        letterSpacing: "-1px",
                        lineHeight: 1.1,
                        opacity: wordOpacity,
                        transform: `translateY(${wordY}px) scale(${wordScale})`,
                        filter:
                          motionBlur > 0.2
                            ? `blur(${motionBlur}px)`
                            : undefined,
                        textShadow: isHighlight
                          ? `0 0 20px ${accentWarn}99, 0 0 40px ${accentWarn}44`
                          : `0 0 12px ${brandColor}cc, 0 0 32px ${brandColor}66`,
                        whiteSpace: "nowrap",
                        willChange: "transform, opacity",
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: "8%",
            height: 4,
            width: `${lineWidthEased * 0.5}%`,
            background: `linear-gradient(270deg, ${brandColor}, ${brandColor}44)`,
            borderRadius: 2,
            marginTop: isVertical ? -60 : 80,
            boxShadow: `0 0 12px ${brandColor}77`,
          }}
        />
      </div>

      <LightLeak opacity={0.07} />
      <Scanlines enabled opacity={0.04} />
    </AbsoluteFill>
  );
};
