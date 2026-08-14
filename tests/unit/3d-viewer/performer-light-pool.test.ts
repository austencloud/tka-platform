import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sceneSource = readFileSync(
  resolve("src/lib/shared/3d/components/Viewer3DScene.svelte"),
  "utf8"
);

describe("performer selection light", () => {
  it("keeps a constant light count while performer rigs enter and leave", () => {
    expect(sceneSource.match(/<T\.PointLight/g)).toHaveLength(1);
    expect(sceneSource).toContain("position={selectedPerformerLightPosition}");
    expect(sceneSource).toContain("intensity={selectedPerformer ? 6 : 0}");

    const performerLoop = sceneSource.slice(
      sceneSource.indexOf("{#each performerManager.performers"),
      sceneSource.lastIndexOf("{/each}")
    );
    expect(performerLoop).not.toContain("<T.PointLight");
  });

  it("keeps one selection-ring mesh set outside the performer loop", () => {
    expect(sceneSource.match(/<T\.RingGeometry/g)).toHaveLength(2);
    expect(sceneSource).toContain("position={selectedPerformerRingPosition}");

    const performerLoop = sceneSource.slice(
      sceneSource.indexOf("{#each performerManager.performers"),
      sceneSource.lastIndexOf("{/each}")
    );
    expect(performerLoop).not.toContain("<T.RingGeometry");
  });
});
