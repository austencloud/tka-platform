/**
 * Static contract test for the SequenceViewerShell host pattern.
 *
 * The /q scan page and the in-app drawer render the SAME shell component so the
 * two surfaces cannot drift (see .claude/rules/sequence-viewer-shell.md and
 * docs/architecture/sequence-viewer-shell.md). This test locks the host
 * contract at the source level: hosts stay thin, chrome lives only in the
 * shell, and the historical drift bugs (hand-rolled chrome, theme-var
 * shadowing, forked breakpoints) cannot silently return.
 *
 * If this test fails, fix the host — do not loosen the assertions.
 */
import { afterEach, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isFirstScanRouteVisit } from "$lib/shared/qr/utils/scan-detection";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SHELL_PATH =
  "src/lib/shared/sequence-viewer/components/SequenceViewerShell.svelte";

// A host may span multiple files (the /q route splits into a thin SSR-head
// +page.svelte + the QScanPage component that renders the shell — 9ed559a6b3);
// the contract applies to the host's combined source.
const HOSTS: Record<string, string[]> = {
  "drawer host": [
    "src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte",
  ],
  "/q scan host": [
    "src/routes/q/[code]/+page.svelte",
    "src/routes/q/[code]/QScanPage.svelte",
  ],
};

/**
 * Chrome internals only the shell may compose. A host importing one of these
 * means viewer chrome is being rebuilt host-side — the exact drift this guards.
 */
const CHROME_INTERNALS = [
  "ViewerHeader.svelte",
  "ViewerSplitPane.svelte",
  "ViewerOverflowMenu.svelte",
  "ExportImagePanel.svelte",
  "VideoPreviewPanel.svelte",
  "PracticeBar.svelte",
  "PracticeSetupBar.svelte",
  "DeleteConfirmDialog.svelte",
  "services/viewer-actions",
];

/** Markup markers owned by the shell; their presence in a host means a fork. */
const SHELL_MARKUP_MARKERS = ["drawer-header", "viewer-and-export"];

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

/** Lines that carry an import specifier (handles multi-line import blocks). */
function importSpecifierLines(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line) || line.includes('from "'));
}

const shellSource = read(SHELL_PATH);
const scanSource = read("src/routes/q/[code]/QScanPage.svelte");
const drawerSource = read(
  "src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte",
);
const sequenceRouteSource = read(
  "src/routes/sequence/[id]/SequenceViewerPage.svelte",
);
const cardHeaderSource = read(
  "src/lib/shared/sequence-viewer/components/CardHeader.svelte"
);
const hostEntries = Object.entries(HOSTS).map(
  ([name, rels]) => [name, rels.map(read).join("\n")] as const,
);

describe("SequenceViewerShell host contract", () => {
  it("shell exists and exposes the host prop seam", () => {
    expect(shellSource).toContain("exportOverrides");
    expect(shellSource).toContain("openAppHref");
    expect(shellSource).toContain("startInSplit");
  });

  it("fits glyph titles at both scan entry and card-header boundaries", () => {
    expect(scanSource.match(/fitToParent/g)).toHaveLength(2);
    expect(cardHeaderSource).toMatch(
      /<TKAWordGlyph[\s\S]*?fitToParent[\s\S]*?\/>/
    );
  });

  it.each(hostEntries)("%s renders SequenceViewerShell", (_name, source) => {
    // Static import (drawer) or lazy import (/q renders it as <ShellComponent>).
    expect(source).toContain("SequenceViewerShell.svelte");
    expect(source).toMatch(/<(?:SequenceViewerShell|ShellComponent)\b/);
  });

  it.each(hostEntries)(
    "%s declares no calculator-owned theme vars (shadowing bug)",
    (_name, source) => {
      // Declarations like `--theme-accent: #123;` shadow the :root values set
      // by applyThemeForBackground() for the whole subtree. Consuming them via
      // var(--theme-accent, fallback) is fine and does not match this pattern.
      const declarations = source.match(/^\s*--(?:theme|semantic)-[\w-]+\s*:/gm);
      expect(declarations ?? []).toEqual([]);
    },
  );

  it.each(hostEntries)(
    "%s imports no chrome internals (chrome lives in the shell)",
    (_name, source) => {
      const imports = importSpecifierLines(source).join("\n");
      const violations = CHROME_INTERNALS.filter((marker) =>
        imports.includes(marker),
      );
      expect(violations).toEqual([]);
    },
  );

  it.each(hostEntries)(
    "%s contains no shell-owned markup markers",
    (_name, source) => {
      const violations = SHELL_MARKUP_MARKERS.filter((marker) =>
        source.includes(marker),
      );
      expect(violations).toEqual([]);
    },
  );

  it.each(hostEntries)(
    "%s uses the shared 768px mobile breakpoint",
    (_name, source) => {
      expect(source).toMatch(/<\s*768\b/);
    },
  );

  it("records card scans only from the dedicated /q host", () => {
    expect(scanSource).toContain("isFirstScanRouteVisit");
    expect(scanSource).toContain("incrementScanCount");
    expect(scanSource).toContain("logScanEvent");

    for (const directLinkSource of [drawerSource, sequenceRouteSource]) {
      expect(directLinkSource).not.toContain("isFirstScanRouteVisit");
      expect(directLinkSource).not.toContain("incrementScanCount");
      expect(directLinkSource).not.toContain("logScanEvent");
    }
  });
});

describe("scan attribution boundary", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
    sessionStorage.clear();
  });

  it("does not treat a typed in-app viewer URL as a card scan", () => {
    window.history.replaceState({}, "", "/create/construct?v=O263");

    expect(isFirstScanRouteVisit("O263")).toBe(false);
    expect(sessionStorage.getItem("tka:scanned:O263")).toBeNull();
  });

  it("allows the dedicated scan route once per tab", () => {
    window.history.replaceState({}, "", "/q/O263");

    expect(isFirstScanRouteVisit("O263")).toBe(true);
    expect(isFirstScanRouteVisit("O263")).toBe(false);
  });
});
