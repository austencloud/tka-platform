import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

/**
 * Every source file, with forward slashes on every platform.
 *
 * `withFileTypes` is load-bearing, not decoration: vitest-browser-svelte writes
 * its baselines into `__screenshots__/<Component>.svelte.test.ts/` DIRECTORIES,
 * 24 of which exist under src/. A name-only filter picks them up and readFileSync
 * throws EISDIR.
 */
function sourceFiles(): string[] {
  return readdirSync("src", { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath}/${entry.name}`.split("\\").join("/"))
    .filter((path) => path.endsWith(".ts") || path.endsWith(".svelte"));
}

const MAIN_APPLICATION =
  "src/lib/shared/application/components/MainApplication.svelte";
const HOST = "src/lib/shared/share-intake/components/ShareIntakeHost.svelte";

describe("share-intake host contract", () => {
  it("MainApplication mounts the host", () => {
    expect(read(MAIN_APPLICATION)).toContain(
      "share-intake/components/ShareIntakeHost.svelte"
    );
  });

  it("the host is mounted beside the inbox drawer, not above the auth gate", () => {
    const source = read(MAIN_APPLICATION);
    const drawer = source.indexOf("inbox/components/InboxDrawer.svelte");
    const host = source.indexOf(
      "share-intake/components/ShareIntakeHost.svelte"
    );
    const viewer = source.indexOf(
      "sequence-viewer/components/SequenceViewerDrawerHost.svelte"
    );
    expect(drawer).toBeGreaterThan(-1);
    expect(viewer).toBeGreaterThan(-1);
    // Same block as the drawer it depends on. If the host drifts above the
    // auth gate it can run before InboxDrawer exists, which is the exact
    // failure this whole task exists to make impossible.
    expect(host).toBeGreaterThan(drawer);
    expect(host).toBeLessThan(viewer);
  });

  it("the runner has exactly one caller in the app", () => {
    // The single-entry-point invariant. Two callers means someone re-added a
    // route trigger outside the component tree, which is how the share ended
    // up opening a picker on the marketing landing.
    const callers = sourceFiles()
      .filter((file) => !file.endsWith("share-intake-runner.ts"))
      // Tests name the runner to mock it. The invariant is about SHIPPED
      // callers, so co-located *.test.ts files are not callers.
      .filter((file) => !file.includes(".test."))
      .filter((file) => read(file).includes("scheduleIntakeRun"));
    expect(callers).toEqual([HOST]);
  }, 30_000);

  it("the host watches the auth state so trace 3 can resume", () => {
    const source = read(HOST);
    expect(source).toContain("authState.isFullAccount");
    expect(source).toContain("scheduleIntakeRun");
  });

  it("the native initializer never routes a share itself", () => {
    const source = read(
      "src/lib/shared/platform/services/native-initializer.ts"
    );
    expect(source).not.toContain("scheduleIntakeRun");
    expect(source).not.toContain("hasPendingShare");
  });
});
