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

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

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
  "/sequence route host": [
    "src/routes/sequence/[id]/SequenceViewerPage.svelte",
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
const shellModelSource = read(
  "src/lib/shared/sequence-viewer/services/viewer-shell-model.ts"
);
const shellShareStateSource = read(
  "src/lib/shared/sequence-viewer/state/viewer-shell-share-state.svelte.ts"
);
const scanSource = read("src/routes/q/[code]/QScanPage.svelte");
const drawerSource = read(
  "src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte"
);
const sequenceRouteSource = read(
  "src/routes/sequence/[id]/SequenceViewerPage.svelte"
);
const cardHeaderSource = read(
  "src/lib/shared/sequence-viewer/components/CardHeader.svelte"
);
const overflowMenuSource = read(
  "src/lib/shared/sequence-viewer/components/ViewerOverflowMenu.svelte"
);
const viewerHeaderSource = read(
  "src/lib/shared/sequence-viewer/components/ViewerHeader.svelte"
);
const viewerSplitPaneSource = read(
  "src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte"
);
const viewerMotionSurfaceSource = read(
  "src/lib/shared/sequence-viewer/components/ViewerMotionSurface.svelte"
);
const viewerCompanionSurfaceSource = read(
  "src/lib/shared/sequence-viewer/components/ViewerCompanionSurface.svelte"
);
const viewerPracticeLaneSource = read(
  "src/lib/shared/sequence-viewer/components/ViewerPracticeLane.svelte"
);
const hostEntries = Object.entries(HOSTS).map(
  ([name, rels]) => [name, rels.map(read).join("\n")] as const
);

describe("SequenceViewerShell host contract", () => {
  it("keeps split geometry separate from pane behavior owners", () => {
    expect(viewerSplitPaneSource).toContain("<ViewerMotionSurface");
    expect(viewerSplitPaneSource).toContain("<ViewerCompanionSurface");
    expect(viewerSplitPaneSource).toContain("<ViewerPracticeLane");
    expect(viewerSplitPaneSource).not.toContain("<AnimatorCanvas");
    expect(viewerSplitPaneSource).not.toContain("createPaneKeepAlive");

    expect(viewerMotionSurfaceSource).toContain("<AnimatorCanvas");
    expect(viewerMotionSurfaceSource).toMatch(
      /<AnimatorCanvas[\s\S]*?\bfillContainer\b[\s\S]*?\/>/
    );
    expect(viewerMotionSurfaceSource).toContain("<LazyMount");
    expect(viewerMotionSurfaceSource).toContain("<RightRail");
    expect(viewerCompanionSurfaceSource).toContain("createPaneKeepAlive");
    expect(viewerCompanionSurfaceSource).toContain("<ChoreoCard");
    expect(viewerCompanionSurfaceSource).toContain("<ArtPane");
    expect(viewerPracticeLaneSource).toContain("<PracticeLanePane");
  });

  it("shell exists and exposes the host prop seam", () => {
    expect(shellSource).toContain("exportOverrides");
    expect(shellSource).toContain("openAppHref");
    expect(shellSource).toContain("onAccountSignIn");
    expect(shellSource).toContain("startInSplit");
    expect(shellSource).toContain("startInCardThenSplit");
    expect(shellSource).toContain("contextContent");
    expect(shellSource).toContain("showFullscreenControls");
    expect(shellSource).toContain("navigation");
  });

  it("keeps the QR account entry inside the shared shell prop seam", () => {
    expect(shellSource).toContain("<ViewerHeader");
    expect(viewerHeaderSource).toContain("authState.isFullAccount");
    expect(viewerHeaderSource).toContain("RobustAvatar");
    expect(scanSource).toMatch(/onAccountSignIn=\{ctx\.openSignInPrompt\}/);
  });

  it("uses one shared Share control and keeps Send inside it", () => {
    expect(viewerHeaderSource).toContain(
      'from "$lib/shared/share/components/ShareActionMenu.svelte"'
    );
    expect(viewerHeaderSource).toContain('testId="viewer-share-button"');
    expect(viewerHeaderSource).toContain("containDesktopMenu={true}");
    expect(viewerHeaderSource).toContain(
      "onActionSelect={onShareActionSelect}"
    );
    expect(shellSource).toContain("createViewerShellShareState");
    expect(shellModelSource).toContain('label: "Share Sequence…"');
    expect(shellModelSource).toContain('label: "Send in TKA"');
    expect(shellModelSource).toMatch(
      /label:\s*linkCopied\s*\?\s*"Copied"\s*:\s*"Copy Link"/
    );
    expect(shellShareStateSource).toContain("shareLinkCopied = true");
    expect(shellSource).toContain(
      "copyDataFeedback={share.copyClaudeFeedback}"
    );
    expect(viewerHeaderSource).not.toContain("onSendTo={handleSendTo}");
  });

  it("does not duplicate wide header actions in the More menu", () => {
    expect(viewerHeaderSource).toContain(
      "onFavoriteToggle={compactChrome ? onFavoriteToggle : undefined}"
    );
    expect(viewerHeaderSource).toContain(
      "onSave={compactChrome ? onSave : undefined}"
    );
    expect(viewerHeaderSource).toContain(
      "onRemix={compactChrome ? onRemix : undefined}"
    );
    expect(viewerHeaderSource).toContain(
      "onCopyData={compactChrome ? onCopyData : undefined}"
    );
    expect(viewerHeaderSource).toContain(
      "onPublish={compactChrome ? onPublish : undefined}"
    );
  });

  it("keeps the current word as the stable centered identity", () => {
    expect(viewerHeaderSource).toContain("<WordActionMenu");
    expect(viewerHeaderSource).toContain("<WordHeader");
    expect(viewerHeaderSource).toContain(
      "activeStepNumber={activeWordStepNumber}"
    );
    expect(shellSource).toContain(
      "sequence={ctx.effectiveSequence ?? sequence}"
    );
    expect(viewerMotionSurfaceSource.match(/\s+hideHeader\s*\n/g)).toHaveLength(
      1
    );
    expect(viewerHeaderSource).not.toContain('label: "Copy word"');
    expect(viewerHeaderSource).not.toContain("Sequence Viewer");
    expect(viewerHeaderSource).not.toContain("Animation Export");
    expect(viewerHeaderSource).not.toContain("Record Scene");
  });

  it("uses Bits UI for the explicit More menu", () => {
    expect(overflowMenuSource).toContain(
      'import { DropdownMenu } from "bits-ui"'
    );
    expect(overflowMenuSource).toContain("<DropdownMenu.Content");
    expect(overflowMenuSource).not.toContain("overflow-backdrop");
    expect(overflowMenuSource).not.toContain(
      "querySelectorAll<HTMLButtonElement>"
    );
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
      const declarations = source.match(
        /^\s*--(?:theme|semantic)-[\w-]+\s*:/gm
      );
      expect(declarations ?? []).toEqual([]);
    }
  );

  it.each(hostEntries)(
    "%s imports no chrome internals (chrome lives in the shell)",
    (_name, source) => {
      const imports = importSpecifierLines(source).join("\n");
      const violations = CHROME_INTERNALS.filter((marker) =>
        imports.includes(marker)
      );
      expect(violations).toEqual([]);
    }
  );

  it.each(hostEntries)(
    "%s contains no shell-owned markup markers",
    (_name, source) => {
      const violations = SHELL_MARKUP_MARKERS.filter((marker) =>
        source.includes(marker)
      );
      expect(violations).toEqual([]);
    }
  );

  it.each(hostEntries)(
    "%s uses the shared 768px mobile breakpoint",
    (_name, source) => {
      expect(source).toMatch(/<\s*768\b/);
    }
  );

  // The counter increment and the scanEvents write moved behind
  // /api/physical-cards/scan, so the host's half of the contract is now the
  // recordCardScan call rather than the two Firestore writes it replaced.
  it("records card scans only from the dedicated /q host", () => {
    expect(scanSource).toContain("isFirstScanRouteVisit");
    expect(scanSource).toContain("recordCardScan");

    for (const directLinkSource of [drawerSource, sequenceRouteSource]) {
      expect(directLinkSource).not.toContain("isFirstScanRouteVisit");
      expect(directLinkSource).not.toContain("recordCardScan");
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
