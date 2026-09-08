import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("performer initial reveal", () => {
  it("does not call a scene ready before the requested cast is visible", () => {
    const canvasSource = readFileSync(
      resolve("src/lib/shared/3d/components/Viewer3DCanvas.svelte"),
      "utf8"
    );
    const curtainSource = readFileSync(
      resolve(
        "src/lib/shared/3d/scene-features/components/SceneLoadingCurtain.svelte"
      ),
      "utf8"
    );
    const directorSource = readFileSync(
      resolve(
        "src/routes/test/film-director/_components/FilmDirectorScene.svelte"
      ),
      "utf8"
    );

    expect(canvasSource).toContain("rendererReady &&\n      performersReady");
    expect(curtainSource).toMatch(
      /sceneFeatures\.allInitialRevealFeaturesSettled\s*&&\s*additionalRevealReady\s*&&\s*warmupComplete/
    );
    expect(directorSource).toContain("waitForPerformersOnInitialReveal={true}");
    expect(directorSource).toContain("enablePerformerLocomotion={true}");
  });
});
