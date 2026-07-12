import { describe, it, expect } from "vitest";
// @ts-expect-error — plain .mjs script module, no type declarations
import {
  parseProductionModules,
  parseConventional,
  resolveModule,
  matchDenylist,
  classifyCommit,
  gateCommits,
  DARK_DENYLIST,
} from "../../scripts/lib/release-module-gate.mjs";

// A miniature stand-in for environment-features.ts, exercising the shapes the
// parser must survive: bare keys, a quoted hyphenated key, trailing comments.
const FIXTURE_SOURCE = `
export const PRODUCTION_MODULES: Record<ModuleId, boolean> = {
  create: true,
  browse: true,
  learn: false, // Unreleased
  mandala: false, // unreleased
  shop: true, // link-out
  "hand-paths": false, // graduated from Lab
};
`;

describe("parseProductionModules", () => {
  it("extracts the boolean map, including quoted/hyphenated keys and comments", () => {
    const map = parseProductionModules(FIXTURE_SOURCE);
    expect(map).toEqual({
      create: true,
      browse: true,
      learn: false,
      mandala: false,
      shop: true,
      "hand-paths": false,
    });
  });

  it("throws when the map is absent", () => {
    expect(() => parseProductionModules("no map here")).toThrow();
  });
});

describe("parseConventional", () => {
  it("pulls type + scope", () => {
    expect(parseConventional("feat(play): arcade")).toEqual({
      type: "feat",
      scope: "play",
    });
  });
  it("handles a breaking-change bang and missing scope", () => {
    expect(parseConventional("fix!: drop legacy")).toEqual({
      type: "fix",
      scope: null,
    });
  });
  it("returns nulls for a non-conventional subject", () => {
    expect(parseConventional("random words")).toEqual({
      type: null,
      scope: null,
    });
  });
});

const PM = parseProductionModules(FIXTURE_SOURCE);

describe("resolveModule", () => {
  it("maps a learn-family scope via the alias table", () => {
    expect(resolveModule({ scope: "guide" }, PM)).toBe("learn");
  });
  it("uses a scope that is itself a module id", () => {
    expect(resolveModule({ scope: "mandala" }, PM)).toBe("mandala");
  });
  it("falls back to the feature dir when scope is unknown", () => {
    expect(
      resolveModule(
        { scope: "misc", files: ["src/lib/features/mandala/foo.ts"] },
        PM,
      ),
    ).toBe("mandala");
  });
  it("aliases the store dir to the shop module", () => {
    expect(
      resolveModule(
        { scope: null, files: ["src/lib/features/store/BuyButton.svelte"] },
        PM,
      ),
    ).toBe("shop");
  });
  it("returns null for shared/infra with no resolvable module", () => {
    expect(
      resolveModule(
        { scope: "auth", files: ["src/lib/shared/auth/x.ts"] },
        PM,
      ),
    ).toBeNull();
  });

  it("does NOT gate a cross-cutting commit that also edits shared/ (the export-sweep false positive)", () => {
    // `feat(export): Share...` touches mandala + shared export infra that live
    // surfaces use — scope resolves nothing, but the shared/ files mean it's
    // cross-cutting, so it must stay shown.
    expect(
      resolveModule(
        {
          scope: "export",
          files: [
            "src/lib/features/mandala/Export.svelte",
            "src/lib/shared/video-export/save.ts",
          ],
        },
        PM,
      ),
    ).toBeNull();
  });

  it("does NOT gate when the feature footprint includes a live module", () => {
    expect(
      resolveModule(
        {
          scope: "misc",
          files: [
            "src/lib/features/mandala/a.ts",
            "src/lib/features/browse/b.ts",
          ],
        },
        PM,
      ),
    ).toBeNull();
  });

  it("still gates a scope-named dark module even when it edits shared/", () => {
    // Scope is authoritative — a mandala-scoped commit is mandala work.
    expect(
      resolveModule(
        {
          scope: "mandala",
          files: ["src/lib/shared/foundation/x.ts"],
        },
        PM,
      ),
    ).toBe("mandala");
  });
});

describe("matchDenylist", () => {
  it("flags the shop LOOP listing by subject", () => {
    const hit = matchDenylist({
      subject: "feat(shop): LOOP deck configurator",
      files: [],
    });
    expect(hit?.label).toMatch(/LOOP/);
  });
  it("flags by path prefix too", () => {
    const hit = matchDenylist({
      subject: "feat(shop): tidy",
      files: ["src/lib/features/store/LoopDeckConfiguratorPage.svelte"],
    });
    expect(hit?.label).toMatch(/LOOP/);
  });
  it("does not flag ordinary shop storefront work", () => {
    expect(
      matchDenylist({ subject: "fix(shop): preorder card rail", files: [] }),
    ).toBeNull();
  });
});

describe("classifyCommit", () => {
  const ctx = { productionModules: PM };

  it("gates a not-yet-released module (play -> learn)", () => {
    const c = classifyCommit({ subject: "feat(play): arcade hub" }, ctx);
    expect(c.module).toBe("learn");
    expect(c.released).toBe(false);
  });

  it("shows a live module", () => {
    const c = classifyCommit({ subject: "fix(browse): thumbnail" }, ctx);
    expect(c.released).toBe(true);
  });

  it("gates the dark shop LOOP sub-feature even though shop is live", () => {
    const c = classifyCommit(
      { subject: "feat(shop): LOOP board recipes" },
      ctx,
    );
    expect(c.released).toBe(false);
    expect(c.darkReason).toMatch(/LOOP/);
  });

  it("leaves shared/infra ungated (null)", () => {
    const c = classifyCommit({ subject: "refactor(export): move type" }, ctx);
    expect(c.module).toBeNull();
    expect(c.released).toBeNull();
  });
});

describe("gateCommits", () => {
  it("splits flagged (dark) from shown (live + unknown)", () => {
    const commits = [
      { subject: "feat(play): arcade" }, // dark: learn
      { subject: "fix(browse): x" }, // live
      { subject: "feat(shop): LOOP deck" }, // dark: denylist
      { subject: "chore(auth): y" }, // unknown -> shown
    ];
    const { flagged, shown } = gateCommits(commits, { productionModules: PM });
    expect(flagged.map((c) => c.subject)).toEqual([
      "feat(play): arcade",
      "feat(shop): LOOP deck",
    ]);
    expect(shown.map((c) => c.subject)).toEqual([
      "fix(browse): x",
      "chore(auth): y",
    ]);
  });
});

describe("DARK_DENYLIST", () => {
  it("ships a shop LOOP entry seeded", () => {
    expect(DARK_DENYLIST.some((r) => /LOOP/.test(r.label))).toBe(true);
  });
});
