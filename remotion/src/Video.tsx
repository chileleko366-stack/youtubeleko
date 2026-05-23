import React from "react";
import { AbsoluteFill } from "remotion";
import type { CompositionProps } from "./Root";

export const Video: React.FC<CompositionProps & { treatment: string }> = (
  props
) => {
  return (
    <AbsoluteFill style={{ backgroundColor: props.backgroundColor }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: props.brandColor,
          fontFamily: props.fontPrimary,
          fontSize: 48,
          padding: 80,
          textAlign: "center",
        }}
      >
        {props.text}
      </div>
    </AbsoluteFill>
  );
};
