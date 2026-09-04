/**
 * Static contract test for the locomotion run tier.
 *
 * The run tier is a second set of clips sharing one gait clock, not a faster
 * playback of the walk. Its failure mode is silent: a missing GLB, a direction
 * key that never made it into the manifest, or a run key that skipped the
 * lateral retarget branch all leave a body that still walks and no error
 * anywhere. This locks the pieces at source level.
 *
 * If this test fails, fix the wiring - do not loosen the assertions.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

const PACKAGE_ROOT = "node_modules/@austencloud/scene-3d/src/lib";
const ANIMATOR = `${PACKAGE_ROOT}/services/implementations/LocomotionAnimator.ts`;
const AVATAR = `${PACKAGE_ROOT}/components/Avatar3D.svelte`;
const PACK = "static/animations/locomotion-pack";

const read = (relative: string): string =>
  readFileSync(path.join(repoRoot, relative), "utf8");

/** Every travel direction the animator can blend, in declaration order. */
const readDirectionKeys = (source: string): string[] => {
  const block = source.match(/const DIRECTION_KEYS = \[([\s\S]*?)\] as const;/);
  expect(block, "DIRECTION_KEYS declaration").not.toBeNull();
  return [...block![1]!.matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
};

describe("locomotion run tier", () => {
  const animator = read(ANIMATOR);
  const avatar = read(AVATAR);
  const directionKeys = readDirectionKeys(animator);

  it("carries a run key for every direction that has a run clip", () => {
    expect(directionKeys).toContain("runForward");
    expect(directionKeys).toContain("runStrafeLeft");
    expect(directionKeys).toContain("runStrafeRight");
  });

  it("maps only the directions the shipped pack can actually run", () => {
    const block = animator.match(
      /const RUN_TIER_KEYS: Partial<Record<DirectionKey, DirectionKey>> = \{([\s\S]*?)\};/
    );
    expect(block, "RUN_TIER_KEYS declaration").not.toBeNull();
    const mapped = [...block![1]!.matchAll(/^\s*(\w+):/gm)].map(
      (match) => match[1]!
    );
    // Backward and grapevine have no run coverage. Mapping them would ask a
    // walk clip for four times its own speed, which is the moonwalk this tier
    // exists to remove.
    expect(mapped.sort()).toEqual(["forward", "strafeLeft", "strafeRight"]);
  });

  it("treats the run strafes as lateral so they get the crossing-safe retarget", () => {
    const block = animator.match(
      /function isLateralKey\(key: string\): boolean \{([\s\S]*?)\n\}/
    );
    expect(block, "isLateralKey declaration").not.toBeNull();
    expect(block![1]).toContain('key === "runStrafeLeft"');
    expect(block![1]).toContain('key === "runStrafeRight"');
  });

  it("derives every per-direction record instead of listing keys by hand", () => {
    // A hand-written literal is how a new direction key gets a slot in five
    // places and a silent hole in the sixth.
    const literals = animator.match(
      /Record<DirectionKey, [^>]+> = \{/g
    );
    expect(literals ?? []).toEqual([]);
    expect(animator).toContain("function directionRecord<T>");
  });

  it("crosses tiers on measured clip speeds, not authored constants", () => {
    // The band is the walk clip's stride ceiling up to the run clip's honest
    // floor. Both ends read nativeSpeed off the loaded clip, so a rig whose
    // retarget lands a slower walk crosses over sooner.
    expect(animator).toContain("const WALK_TIER_CEILING = 1.15;");
    expect(animator).toContain("const RUN_TIER_FLOOR = 0.8;");
    const block = animator.match(
      /private runTierFraction\([\s\S]*?\n  \}/
    );
    expect(block, "runTierFraction declaration").not.toBeNull();
    expect(block![0]).toContain("walk.nativeSpeed * this.rootWorldScale");
    expect(block![0]).toContain("run.nativeSpeed * this.rootWorldScale");
    // No run action loaded means no run tier, so a pack without run coverage
    // behaves exactly as it did before the tier existed.
    expect(block![0]).toContain("!this.walkActions[runKey]");
  });

  it("ships every clip the manifest asks for", () => {
    // Entries are written either as a plain name or with the ${rmSuffix}
    // interpolation that selects the in-place-off export, so a suffixed entry
    // owes both files.
    const referenced: string[] = [];
    for (const match of avatar.matchAll(
      /\$\{animBase\}([\w-]+?)(\$\{rmSuffix\})?\.glb/g
    )) {
      const stem = match[1]!;
      if (match[2]) referenced.push(`${stem}.glb`, `${stem}-rm.glb`);
      else referenced.push(`${stem}.glb`);
    }
    expect(referenced.length).toBeGreaterThan(0);
    expect(referenced).toContain("run.glb");
    expect(referenced).toContain("strafe-run-left.glb");
    expect(referenced).toContain("strafe-run-right.glb");
    for (const file of new Set(referenced)) {
      // A missing GLB resolves to the SPA index under SvelteKit, so the loader
      // fails inside a catch and the tier never engages with nothing on screen
      // to say why.
      expect(
        existsSync(path.join(repoRoot, PACK, file)),
        `${PACK}/${file} is referenced by the animation manifest`
      ).toBe(true);
    }
  });
});
