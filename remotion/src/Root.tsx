import React from "react";
import { Composition } from "remotion";
import { TypographicVideo } from "./video/TypographicVideo";
import { bogotazo } from "./score/examples/bogotazo";
import { FIXTURES } from "./score/examples/fixtures";
import type { TypographicScore } from "./score/schema";

/**
 * Una sola composicion parametrica: la duracion y el tamano salen de la propia
 * partitura (calculateMetadata), asi el Director puede pasar cualquier score y
 * el video se ajusta solo. Las `fx-*` son fixtures de QA: una por estilo.
 */
const metadataFromScore = ({ props }: { props: Record<string, unknown> }) => {
  const { meta } = props as unknown as TypographicScore;
  return {
    durationInFrames: meta.durationInFrames,
    fps: meta.fps,
    width: meta.width,
    height: meta.height,
  };
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="TypographicVideo"
        component={TypographicVideo as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={bogotazo.meta.durationInFrames}
        fps={bogotazo.meta.fps}
        width={bogotazo.meta.width}
        height={bogotazo.meta.height}
        defaultProps={bogotazo as unknown as Record<string, unknown>}
        calculateMetadata={metadataFromScore}
      />
      {Object.entries(FIXTURES).map(([styleId, score]) => (
        <Composition
          key={styleId}
          id={`fx-${styleId}`}
          component={TypographicVideo as unknown as React.ComponentType<Record<string, unknown>>}
          durationInFrames={score.meta.durationInFrames}
          fps={score.meta.fps}
          width={score.meta.width}
          height={score.meta.height}
          defaultProps={score as unknown as Record<string, unknown>}
          calculateMetadata={metadataFromScore}
        />
      ))}
    </>
  );
};
