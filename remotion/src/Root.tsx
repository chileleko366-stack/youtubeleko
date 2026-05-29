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
// CH6 Red Space Facts compositions
import { SpaceTitle } from "./compositions/SpaceTitle";
import { SpaceStat } from "./compositions/SpaceStat";
import { StarField } from "./compositions/StarField";
import { PlanetReveal } from "./compositions/PlanetReveal";
import { OrbitPath } from "./compositions/OrbitPath";
import { CosmicTimeline } from "./compositions/CosmicTimeline";
import { SpaceQuote } from "./compositions/SpaceQuote";
import { MissionBrief } from "./compositions/MissionBrief";
import { NebulaBulletList } from "./compositions/NebulaBulletList";
import { GalaxyDataViz } from "./compositions/GalaxyDataViz";
import { BlackHoleZoom } from "./compositions/BlackHoleZoom";
import { CosmicScale } from "./compositions/CosmicScale";
import { LaunchSequence } from "./compositions/LaunchSequence";
import { SpaceSplitScreen } from "./compositions/SpaceSplitScreen";
import { AstroFact } from "./compositions/AstroFact";

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
  // CH6 Red Space Facts
  { id: "SpaceTitle", component: SpaceTitle },
  { id: "SpaceStat", component: SpaceStat },
  { id: "StarField", component: StarField },
  { id: "PlanetReveal", component: PlanetReveal },
  { id: "OrbitPath", component: OrbitPath },
  { id: "CosmicTimeline", component: CosmicTimeline },
  { id: "SpaceQuote", component: SpaceQuote },
  { id: "MissionBrief", component: MissionBrief },
  { id: "NebulaBulletList", component: NebulaBulletList },
  { id: "GalaxyDataViz", component: GalaxyDataViz },
  { id: "BlackHoleZoom", component: BlackHoleZoom },
  { id: "CosmicScale", component: CosmicScale },
  { id: "LaunchSequence", component: LaunchSequence },
  { id: "SpaceSplitScreen", component: SpaceSplitScreen },
];

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
      {/* AstroFact — 16:9 standard */}
      <Composition
        id="AstroFact"
        component={AstroFact as React.ComponentType<CompositionProps>}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: props.durationInFrames ?? 90,
        })}
      />
      {/* AstroFactShort — 9:16 vertical for YouTube Shorts */}
      <Composition
        id="AstroFactShort"
        component={AstroFact as React.ComponentType<CompositionProps>}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
        calculateMetadata={async ({ props }) => ({
          durationInFrames: props.durationInFrames ?? 90,
        })}
      />
    </>
  );
};
