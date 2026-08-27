const fs = require("fs");
const path = require("path");

const SPECS_DIR = path.join(__dirname, "..", "docs", "superpowers", "specs");
const TODAY = "2026-04-26";

const metadata = {
  // === ACTIVE ===
  "active/2026-04-15-sequence-viewer-redesign-design.md": {
    status: "active", value: 4, effort: "L",
    remaining: "Resume Phase 2 Task 11 (DestinationBadge). 14 tasks across 3 phases",
  },
  "active/2026-04-20-sequence-engine-unification-design.md": {
    status: "active", value: 5, effort: "L",
    remaining: "Delete app-side executors, consolidate MCP copies, publish packages",
  },
  "active/2026-04-24-native-mobile-integration-design.md": {
    status: "active", value: 5, effort: "L",
    remaining: "Phase 2: SQLite offline, native auth, haptics. iOS + store submission",
  },
  "active/effects-unification-deferred-items.md": {
    status: "active", value: 2, effort: "M",
    remaining: "Crackle 3D parity, FireTipTracker aliasing, zap dark mode check",
  },
  "active/sequence-viewer-redesign-notes.md": {
    status: "active", value: 4, effort: "L",
    remaining: "Architectural reference for Phase 2+ implementation",
  },

  "backlog/2026-03-10-store-screenshot-capture-design.md": {
    status: "backlog", value: 2, effort: "M",
    remaining: "Admin capture button, Firebase gallery drawer, Play Store slots",
  },
  "backlog/2026-03-11-invert-rotation-toggle-design.md": {
    status: "backlog", value: 3, effort: "S",
    remaining: "Single Invert button replacing CW/CCW pair",
  },
  "backlog/2026-03-11-my-props-editor-design.md": {
    status: "backlog", value: 3, effort: "M",
    remaining: "Full build — prop collection editor",
  },
  "backlog/2026-03-13-hand-path-ecosystem-design.md": {
    status: "backlog", value: 4, effort: "L",
    remaining: "3 lab tabs: Atlas, Builder, Disassemble view",
  },
  "backlog/2026-03-14-creator-intent-and-compositional-finalization-design.md": {
    status: "backlog", value: 3, effort: "L",
    remaining: "Full build — compositional intent model",
  },
  "backlog/2026-03-14-r2-video-storage-migration-design.md": {
    status: "backlog", value: 5, effort: "S",
    remaining: "Core live. Verify multipart for large files",
  },
  "backlog/2026-03-16-media-workspace-design.md": {
    status: "backlog", value: 3, effort: "M",
    remaining: "Beat mapping, synced playback, viewer panel lifecycle",
  },
  "backlog/2026-03-17-create-offline-persistence-design.md": {
    status: "backlog", value: 4, effort: "S",
    remaining: "Verify offline save-to-library e2e",
  },
  "backlog/2026-03-17-offline-first-architecture-design.md": {
    status: "backlog", value: 4, effort: "M",
    remaining: "Proactive SVG prefetch, status indicators. Festival scenario",
  },
  "backlog/2026-03-18-adaptive-gallery-controls-design.md": {
    status: "backlog", value: 4, effort: "S",
    remaining: "Full build — responsive gallery controls",
  },
  "backlog/2026-03-18-gallery-virtualization-sidebar-design.md": {
    status: "backlog", value: 4, effort: "S",
    remaining: "Visual QA — sidebar was reverted once for styling",
  },
  "backlog/2026-03-19-compositional-data-model.md": {
    status: "backlog", value: 3, effort: "M",
    remaining: "2x2 browse taxonomy UI, progressive disclosure",
  },
  "backlog/2026-03-19-orientation-selector-ux-improvements.md": {
    status: "backlog", value: 2, effort: "S",
    remaining: "Verify CW/CCW to clock/counter label fix, mobile positioning",
  },
  "backlog/2026-03-19-profile-screen-design.md": {
    status: "backlog", value: 3, effort: "M",
    remaining: "Full build — user profile screen",
  },
  "backlog/2026-03-19-unified-create-tab-hints-design.md": {
    status: "backlog", value: 4, effort: "S",
    remaining: "Full build — contextual hints in create tab",
  },
  "backlog/2026-03-20-mpc-print-prep-tab-design.md": {
    status: "backlog", value: 4, effort: "S",
    remaining: "Verify PDF at 822x1122px MPC spec",
  },
  "backlog/2026-03-23-festival-hub-design.md": {
    status: "backlog", value: 2, effort: "XL",
    remaining: "Real data pipeline, map population, social attendance layer",
  },
  "backlog/2026-03-26-applications-tab-design.md": {
    status: "backlog", value: 2, effort: "S",
    remaining: "Act editing modal, performer portfolio completion",
  },
  "backlog/2026-03-26-card-designer-split-screen-design.md": {
    status: "backlog", value: 2, effort: "M",
    remaining: "Full build — split-screen card designer",
  },
  "backlog/2026-03-26-portfolio-lower-sections-redesign-design.md": {
    status: "backlog", value: 2, effort: "S",
    remaining: "Visual QA — all 5 sections redesigned",
  },
  "backlog/2026-03-27-1989-route-elevation-design.md": {
    status: "backlog", value: 3, effort: "XL",
    remaining: "Real command parser, ASCII pictograph renderer, auth adapter",
  },
  "backlog/2026-03-27-1995-route-elevation-design.md": {
    status: "backlog", value: 3, effort: "XL",
    remaining: "Wire all 10 apps to real DI services",
  },
  "backlog/2026-03-27-1998-route-elevation-design.md": {
    status: "backlog", value: 2, effort: "L",
    remaining: "Full build — Win98 route elevation",
  },
  "backlog/2026-03-27-2003-route-elevation-design.md": {
    status: "backlog", value: 2, effort: "L",
    remaining: "Full build — XP route elevation",
  },
  "backlog/2026-03-28-fuse-tab-v2-design.md": {
    status: "backlog", value: 3, effort: "L",
    remaining: "Full rebuild — v2 was reverted. FLIP approach failed",
  },
  "backlog/2026-03-28-merge-card-view-into-decks-design.md": {
    status: "backlog", value: 2, effort: "M",
    remaining: "Full build — merge card view into decks tab",
  },
  "backlog/2026-03-28-unified-render-composition-design.md": {
    status: "backlog", value: 3, effort: "L",
    remaining: "Full build — unified render composition pipeline",
  },
  "backlog/2026-03-30-unified-museum-mode-design.md": {
    status: "backlog", value: 4, effort: "M",
    remaining: "E-key interaction + overlay in 3D mode",
  },
  "backlog/2026-03-31-effect-state-unification-design.md": {
    status: "backlog", value: 5, effort: "S",
    remaining: "Trail path into tipEffectMap, localStorage key cleanup",
  },
  "backlog/2026-04-01-museum-interior-design-system.md": {
    status: "backlog", value: 3, effort: "XL",
    remaining: "Era-matched TVs, design validator, dev whiteboards",
  },
  "backlog/2026-04-01-physical-merch-store-design.md": {
    status: "backlog", value: 3, effort: "L",
    remaining: "Full build — Stripe + MakePlayingCards",
  },
  "backlog/2026-04-01-view-sequence-mcp-tool-design.md": {
    status: "backlog", value: 3, effort: "M",
    remaining: "Full build — MCP tool for viewing sequences",
  },
  "backlog/2026-04-04-arrow-tip-z-promotion-design.md": {
    status: "backlog", value: 4, effort: "M",
    remaining: "Illustrator SVG splitting for 60 arrows + manifest",
    blocked_by: "Manual Illustrator workflow",
  },
  "backlog/2026-04-04-museum-game-integration-tests-design.md": {
    status: "backlog", value: 2, effort: "S",
    remaining: "Suites 2-4: RoomGraph, GameBridge, ResourceDisposal",
  },
  "backlog/2026-04-05-atomic-plane-system-design.md": {
    status: "backlog", value: 4, effort: "M",
    remaining: "L8 done. Verify and close out. L9 fusion = new spec",
  },
  "backlog/2026-04-05-per-room-lighting.md": {
    status: "backlog", value: 3, effort: "M",
    remaining: "Replace global ambient with per-room local lights",
  },
  "backlog/2026-04-05-unified-view-toggle-and-perf-harness.md": {
    status: "backlog", value: 2, effort: "M",
    remaining: "Perf harness for isolated-room benchmarking",
  },
  "backlog/2026-04-06-arrange-tab-unified-sidebar-design.md": {
    status: "backlog", value: 3, effort: "M",
    remaining: "Collapsible-section refactor of arrange tab",
  },
  "backlog/2026-04-08-led-strip-pattern-engine-design.md": {
    status: "backlog", value: 4, effort: "L",
    remaining: "USB serial Ignis upload, hardware integration",
    blocked_by: "Physical LED poi hardware",
  },
  "backlog/2026-04-10-poi-image-library.md": {
    status: "backlog", value: 3, effort: "M",
    remaining: "Firebase persistence layer (local library works)",
  },
  "backlog/2026-04-10-timeline-sequence-integration.md": {
    status: "backlog", value: 2, effort: "M",
    remaining: "Full build — timeline + sequence integration",
  },
  "backlog/2026-04-11-collision-lab-future-work.md": {
    status: "backlog", value: 2, effort: "L",
    remaining: "BVH mesh collision, leg model, costume collision",
  },
  "backlog/2026-04-11-multi-avatar-foundation-design.md": {
    status: "backlog", value: 3, effort: "L",
    remaining: "UI: add/remove buttons, formation picker, undo, persistence",
  },
  "backlog/2026-04-11-turn-in-place-animation-design.md": {
    status: "backlog", value: 3, effort: "M",
    remaining: "Authored turn clips for 14 heading changes",
  },
  "backlog/2026-04-14-festival-qr-offline-audit.md": {
    status: "backlog", value: 4, effort: "M",
    remaining: "iOS Universal Links, web fallback redirect",
  },
  "backlog/2026-04-14-sequence-viewer-unification-design.md": {
    status: "backlog", value: 4, effort: "M",
    remaining: "Route consolidation — merge /p/ and /sequence/ into one shell",
  },
  "backlog/2026-04-15-unified-gpu-render-pipeline-design.md": {
    status: "backlog", value: 5, effort: "L",
    remaining: "WebGPU backend, full 2D migration. Incremental",
  },
  "backlog/2026-04-17-level-modal-redesign-design.md": {
    status: "backlog", value: 4, effort: "S",
    remaining: "Full build — redesigned level selection modal",
  },
  "backlog/2026-04-18-shortcode-durability-roadmap.md": {
    status: "backlog", value: 3, effort: "S",
    remaining: "Wave 2 polish: sparklines, zero-scan candidates view",
  },
  "backlog/2026-04-19-mobile-bento-export-panels-design.md": {
    status: "backlog", value: 3, effort: "S",
    remaining: "Sub-sheet polish on export panels",
  },
  "backlog/2026-04-20-chimera-mandala-builder-scoping-memo.md": {
    status: "backlog", value: 2, effort: "L",
    remaining: "Scoping memo. Needs canonical form first",
    blocked_by: "mandala-canonical-form",
  },
  "backlog/2026-04-20-mandala-canonical-form-scoping-memo.md": {
    status: "backlog", value: 3, effort: "L",
    remaining: "Scoping memo. Needs full spec",
  },
  "backlog/2026-04-24-level-1-guide-redesign.md": {
    status: "backlog", value: 4, effort: "L",
    remaining: "Content authoring for 40+ interactive pages",
  },
  "backlog/2026-04-25-silk-polish-design.md": {
    status: "backlog", value: 3, effort: "M",
    remaining: "6 renderer upgrades (~280 LOC). Well-scoped",
  },
};

const EFFORT_MULT = { XS: 5, S: 4, M: 3, L: 2, XL: 1 };

let injected = 0;
let skipped = 0;

for (const [relPath, meta] of Object.entries(metadata)) {
  const filePath = path.join(SPECS_DIR, relPath);
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING: ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, "utf8");

  // Strip existing frontmatter if present
  if (content.startsWith("---")) {
    const endIdx = content.indexOf("---", 3);
    if (endIdx !== -1) {
      content = content.slice(endIdx + 3).replace(/^\n+/, "");
    }
  }

  const score = meta.value * EFFORT_MULT[meta.effort];
  const fm = [
    "---",
    `status: ${meta.status}`,
    `value: ${meta.value}`,
    `effort: ${meta.effort}`,
    `score: ${score}`,
    `remaining: "${meta.remaining}"`,
  ];
  if (meta.blocked_by) {
    fm.push(`blocked_by: "${meta.blocked_by}"`);
  }
  fm.push(`last_triaged: ${TODAY}`);
  fm.push("---");
  fm.push("");

  fs.writeFileSync(filePath, fm.join("\n") + content, "utf8");
  injected++;
}

console.log(`Injected frontmatter: ${injected} files`);
console.log(`Skipped: ${skipped} files`);
