import type { Stats } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  ARROW_SPRITE_WATCH_PATH,
  createViteDevWatchIgnoredMatcher,
  I18N_MESSAGES_WATCH_PATH,
} from "../../../src/config/vite-dev-watch-policy";

const projectRoot = path.resolve("test-fixtures", "vite-watch-root");
const directoryStats = { isFile: () => false } as Stats;
const fileStats = { isFile: () => true } as Stats;

function projectPath(...segments: string[]): string {
  return path.join(projectRoot, ...segments);
}

describe("Vite dev watch policy", () => {
  const isIgnored = createViteDevWatchIgnoredMatcher(projectRoot);

  it("keeps app source and translation messages in HMR scope", () => {
    expect(isIgnored(projectPath("src"), directoryStats)).toBe(false);
    expect(
      isIgnored(projectPath("src", "routes", "+page.svelte"), fileStats)
    ).toBe(false);
    expect(
      isIgnored(projectPath(I18N_MESSAGES_WATCH_PATH, "en.json"), fileStats)
    ).toBe(false);
  });

  it("watches package source and config without watching package output", () => {
    expect(
      isIgnored(projectPath("packages", "sequence-engine"), directoryStats)
    ).toBe(false);
    expect(
      isIgnored(
        projectPath("packages", "sequence-engine", "src", "index.ts"),
        fileStats
      )
    ).toBe(false);
    expect(
      isIgnored(
        projectPath("packages", "sequence-engine", "package.json"),
        fileStats
      )
    ).toBe(false);

    for (const generatedDirectory of [
      "dist",
      "node_modules",
      "tests",
      ".svelte-kit",
    ]) {
      expect(
        isIgnored(
          projectPath("packages", "sequence-engine", generatedDirectory),
          directoryStats
        )
      ).toBe(true);
    }
  });

  it("reaches the arrow sprite without watching sibling static assets", () => {
    expect(isIgnored(projectPath("static"), directoryStats)).toBe(false);
    expect(isIgnored(projectPath("static", "images"), directoryStats)).toBe(
      false
    );
    expect(isIgnored(projectPath(ARROW_SPRITE_WATCH_PATH), fileStats)).toBe(
      false
    );
    expect(
      isIgnored(projectPath("static", "images", "gallery"), directoryStats)
    ).toBe(true);
    expect(isIgnored(projectPath("static", "models"), directoryStats)).toBe(
      true
    );
  });

  it("watches the generated SvelteKit manifest so new routes hot-load", () => {
    expect(isIgnored(projectPath(".svelte-kit"), directoryStats)).toBe(false);
    expect(
      isIgnored(projectPath(".svelte-kit", "generated"), directoryStats)
    ).toBe(false);
    expect(
      isIgnored(
        projectPath(".svelte-kit", "generated", "client", "app.js"),
        fileStats
      )
    ).toBe(false);
    expect(isIgnored(projectPath(".svelte-kit", "types"), directoryStats)).toBe(
      true
    );
    expect(
      isIgnored(projectPath(".svelte-kit", "output"), directoryStats)
    ).toBe(true);
  });

  it("prunes new top-level directories and junctions after stat", () => {
    expect(isIgnored(projectPath(".codex-source-link"))).toBe(false);
    expect(isIgnored(projectPath(".codex-source-link"), directoryStats)).toBe(
      true
    );
    expect(isIgnored(projectPath("android"), directoryStats)).toBe(true);
    expect(isIgnored(projectPath("src-tauri"), directoryStats)).toBe(true);
  });

  it("preserves root files and Vite dependencies outside the checkout", () => {
    expect(isIgnored(projectPath("vite.config.ts"), fileStats)).toBe(false);
    expect(isIgnored(projectPath(".env.local"), fileStats)).toBe(false);
    expect(
      isIgnored(
        path.join(path.dirname(projectRoot), "shared.config.ts"),
        fileStats
      )
    ).toBe(false);
  });
});
