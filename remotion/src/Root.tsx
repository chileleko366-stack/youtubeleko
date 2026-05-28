import { Composition } from "remotion";
import { TextReveal } from "./compositions/TextReveal";
import { SplitScreen } from "./compositions/SplitScreen";
import { Fullscreen } from "./compositions/Fullscreen";
import { CelebrityCard } from "./compositions/CelebrityCard";
import { StatsBanner } from "./compositions/StatsBanner";
import { Quote } from "./compositions/Quote";
import { Timeline } from "./compositions/Timeline";
import { BulletList } from "./compositions/BulletList";
import { ImageReveal } from "./compositions/ImageReveal";
import { DataViz } from "./compositions/DataViz";
import { DocumentScan } from "./compositions/DocumentScan";
import { ArchiveFootage } from "./compositions/ArchiveFootage";
import { BrainDiagram } from "./compositions/BrainDiagram";
import { SpaceScene } from "./compositions/SpaceScene";
import type { SpaceSceneProps } from "./compositions/SpaceScene";

export type CompositionProps = {
  text: string;
  brandColor: string;
  backgroundColor: string;
  fontPrimary: string;
  fontSecondary: string;
  durationInFrames: number;
  bullets?: string[];
  statValue?: string;
  quoteText?: string;
};

const defaultProps: CompositionProps = {
  text: "Sample text for preview",
  brandColor: "#e8ff47",
  backgroundColor: "#0a0a0a",
  fontPrimary: "Anton",
  fontSecondary: "Inter",
  durationInFrames: 90,
};

const compositions = [
  { id: "TextReveal", component: TextReveal },
  { id: "SplitScreen", component: SplitScreen },
  { id: "Fullscreen", component: Fullscreen },
  { id: "CelebrityCard", component: CelebrityCard },
  { id: "StatsBanner", component: StatsBanner },
  { id: "Quote", component: Quote },
  { id: "Timeline", component: Timeline },
  { id: "BulletList", component: BulletList },
  { id: "ImageReveal", component: ImageReveal },
  { id: "DataViz", component: DataViz },
  { id: "DocumentScan", component: DocumentScan },
  { id: "ArchiveFootage", component: ArchiveFootage },
  { id: "BrainDiagram", component: BrainDiagram },
];

const spaceDefaultProps: SpaceSceneProps = {
  sceneType: "stars",
  accentColor: "#ff2222",
  durationInFrames: 90,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {compositions.map(({ id, component: Component }) => (
        <Composition
          key={id}
          id={id}
          component={Component as React.ComponentType<CompositionProps>}
          durationInFrames={90}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={defaultProps}
          calculateMetadata={async ({ props }) => ({
            durationInFrames: props.durationInFrames ?? 90,
          })}
        />
      ))}

      {/* CH6 — portrait space scene (1080×1920) */}
      <Composition
        id="SpaceScene"
        component={SpaceScene}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={spaceDefaultProps}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: (props as SpaceSceneProps).durationInFrames ?? 90,
        })}
      />
    </>
  );
};
