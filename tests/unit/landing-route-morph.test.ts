import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LAUNCHPAD_TILES } from "../../src/lib/shared/landing/components/launchpad/launchpad-tiles";
import {
  LAUNCHPAD_MORPH_PATHS,
  navigationMorphs,
} from "../../src/lib/shared/transitions/navigation-morphs";
import {
  isNamedRouteMorphActive,
  NAMED_ROUTE_MORPH_CLASS,
  runAfterNamedRouteMorph,
  runAfterNamedRouteMorphIdle,
  runNamedRouteMorph,
} from "../../src/lib/shared/transitions/named-route-morph-state.svelte";

const readSource = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), "utf-8");

// A destination may host its morph participant in a local component rather than
// in +page.svelte — /notation puts its header inside NotationCatalog. Each entry
// therefore lists every file the participant is allowed to live in.
const routeSourceByPath: Record<string, string[]> = {
  "/composer": ["src/routes/(public)/composer/+page.svelte"],
  "/shop/choreography-cards": [
    "src/routes/(public)/shop/choreography-cards/+page.svelte",
  ],
  "/guide": ["src/routes/(public)/guide/+page.svelte"],
  "/notation": [
    "src/routes/(public)/notation/+page.svelte",
    "src/routes/(public)/notation/_components/NotationCatalog.svelte",
  ],
  "/faq": ["src/routes/(public)/faq/+page.svelte"],
  "/glossary": ["src/routes/(public)/glossary/+page.svelte"],
};

const location = (pathname: string, routeId = pathname) => ({
  url: { pathname },
  route: { id: routeId },
});

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: () => void;
} {
  let resolvePromise!: () => void;
  let rejectPromise!: () => void;
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = () => reject(new Error("transition failed"));
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

afterEach(() => {
  document.documentElement.classList.remove(NAMED_ROUTE_MORPH_CLASS);
  vi.unstubAllGlobals();
});

describe("landing route morph allowlist", () => {
  it("allows every launchpad morph in both directions", () => {
    expect(LAUNCHPAD_MORPH_PATHS).toEqual(
      LAUNCHPAD_TILES.filter((tile) => tile.morphName).map((tile) => tile.href)
    );

    for (const pathname of LAUNCHPAD_MORPH_PATHS) {
      expect(navigationMorphs(location("/"), location(pathname))).toBe(true);
      expect(navigationMorphs(location(pathname), location("/"))).toBe(true);
    }
  });

  it("preserves the browse and sequence shared-thumbnail pair", () => {
    expect(
      navigationMorphs(location("/browse/community"), location("/sequence/abc"))
    ).toBe(true);
    expect(
      navigationMorphs(location("/sequence/abc"), location("/browse"))
    ).toBe(true);
  });

  it("allows only the shop index and generic product-detail route", () => {
    const shop = location("/shop", "/(public)/shop");
    const product = location(
      "/shop/level-1-guide",
      "/(public)/shop/[productId]"
    );

    expect(navigationMorphs(shop, product)).toBe(true);
    expect(navigationMorphs(product, shop)).toBe(true);
    expect(
      navigationMorphs(
        shop,
        location("/shop/loop-deck", "/(public)/shop/loop-deck")
      )
    ).toBe(false);
  });

  it("rejects same-page, unrelated, and destination-to-destination navigation", () => {
    expect(navigationMorphs(null, location("/composer"))).toBe(false);
    expect(navigationMorphs(location("/"), undefined)).toBe(false);
    expect(navigationMorphs(location("/"), location("/"))).toBe(false);
    expect(navigationMorphs(location("/about"), location("/composer"))).toBe(
      false
    );
    expect(navigationMorphs(location("/composer"), location("/faq"))).toBe(
      false
    );
    expect(navigationMorphs(location("/browse"), location("/notation"))).toBe(
      false
    );
    expect(
      navigationMorphs(location("/browse-old"), location("/sequence/abc"))
    ).toBe(false);
  });
});

describe("landing shared-element contract", () => {
  it("gives every tile one unique name and a matching destination participant", () => {
    const morphNames = LAUNCHPAD_TILES.map((tile) => tile.morphName);
    expect(morphNames.every(Boolean)).toBe(true);
    expect(new Set(morphNames).size).toBe(morphNames.length);
    expect(Object.keys(routeSourceByPath).sort()).toEqual(
      [...LAUNCHPAD_MORPH_PATHS].sort()
    );

    const tileSource = readSource(
      "src/lib/shared/landing/components/launchpad/LaunchpadTile.svelte"
    );
    expect(tileSource).toContain("style:view-transition-name={tile.morphName}");

    for (const tile of LAUNCHPAD_TILES) {
      const morphName = tile.morphName;
      expect(morphName).toBeTruthy();
      if (!morphName) continue;

      const routePaths = routeSourceByPath[tile.href];
      expect(routePaths).toBeTruthy();
      if (!routePaths) continue;
      const hostsParticipant = routePaths.some((path) =>
        readSource(path).includes(`style:view-transition-name="${morphName}"`)
      );
      expect(
        hostsParticipant,
        `${tile.href} has no element named ${morphName}, so its tile morph degrades to a cut`
      ).toBe(true);
    }
  });

  it("styles every named group and suppresses only the scoped root capture", () => {
    const css = readSource("src/lib/shared/transitions/view-transitions.css");
    for (const morphName of LAUNCHPAD_TILES.map((tile) => tile.morphName)) {
      expect(css).toContain(`::view-transition-group(${morphName})`);
    }

    expect(css).toMatch(
      /html\.named-route-morph\s*\{\s*view-transition-name:\s*none;/
    );
    expect(css).toMatch(
      /html\.named-route-morph::view-transition\s*\{\s*background:\s*transparent;/
    );
  });

  it("feature-detects View Transitions and bypasses motion-sensitive navigation", () => {
    const layout = readSource("src/routes/+layout.svelte");
    const runIndex = layout.indexOf("runNamedRouteMorph(() =>");
    const guards = [
      "if (!document.startViewTransition) return;",
      "if (reducedMotion()) return;",
      "if (!navigationMorphs(navigation.from, navigation.to)) return;",
    ];

    expect(runIndex).toBeGreaterThan(-1);
    for (const guard of guards) {
      const guardIndex = layout.indexOf(guard);
      expect(guardIndex, `missing route-morph guard: ${guard}`).toBeGreaterThan(
        -1
      );
      expect(
        guardIndex,
        `route-morph guard runs too late: ${guard}`
      ).toBeLessThan(runIndex);
    }
  });

  it("links the shop book listing and detail cover with one named participant", () => {
    const listing = readSource("src/lib/features/store/StorePage.svelte");
    const detail = readSource(
      "src/lib/features/store/ProductDetailPage.svelte"
    );
    const cover = readSource(
      "src/lib/features/store/components/BookCoverArt.svelte"
    );
    const css = readSource("src/lib/shared/transitions/view-transitions.css");

    expect(listing).toContain(
      '<BookCoverArt viewTransitionName="shop-book-cover" />'
    );
    expect(detail).toContain('viewTransitionName="shop-book-cover"');
    expect(cover).toContain("style:view-transition-name={viewTransitionName}");
    expect(css).toContain("::view-transition-group(shop-book-cover)");
  });

  it("suppresses the marketing fade only during an active named morph", () => {
    const chrome = readSource(
      "src/lib/shared/landing/components/MarketingChrome.svelte"
    );
    expect(chrome).toContain("isNamedRouteMorphActive()");
    expect(chrome).toMatch(
      /duration:\s*suppressContentFade\s*\?\s*0\s*:\s*motionDuration\(200\)/
    );
    expect(chrome).toContain(
      'import { motionDuration } from "$lib/shared/transitions/motion";'
    );
    expect(chrome).not.toContain("MORPH_PATHS.has(path)");
  });

  it("keeps the Guide hub inside persistent root chrome", () => {
    const layout = readSource("src/routes/+layout.svelte");
    const guidePage = readSource("src/routes/(public)/guide/+page.svelte");
    const guideShell = readSource(
      "src/routes/(public)/guide/_components/GuideShell.svelte"
    );
    const guideCss = readSource(
      "src/routes/(public)/guide/level-1/_styles/guide.css"
    );

    expect(layout).toMatch(/MARKETING_EXACT[\s\S]*"\/guide"/);
    expect(guideShell).toContain(
      'const ownsStandaloneChrome = $derived(page.url.pathname !== "/guide")'
    );
    expect(guideShell).toContain("{#if ownsStandaloneChrome}");
    expect(guidePage).not.toContain(
      'import { joinWaitlist } from "$lib/features/store/services/waitlist"'
    );
    expect(guidePage).toContain(
      'await import("$lib/features/store/services/waitlist")'
    );
    expect(guideCss).toContain("html:has(.guide-layout):not(:has(.mkt-shell))");
  });

  it("keeps development morph probes out of the console POST bridge", () => {
    const layout = readSource("src/routes/+layout.svelte");
    const appShell = readSource("src/app.html");
    expect(layout).toContain("console.debug(`[morph]");
    expect(layout).not.toContain("console.log(`[morph]");
    expect(layout).toContain("po?.takeRecords()");
    expect(appShell).toContain("/^\\[morph\\]/");
    expect(appShell).toContain("/^\\[FrameStats\\]/");
  });

  it("keeps heavy landing and destination media out of the morph window", () => {
    const homeHero = readSource(
      "src/lib/shared/landing/components/HomeHero.svelte"
    );
    const sequenceHero = readSource(
      "src/lib/shared/landing/components/SequenceHeroDemo.svelte"
    );
    const launchpad = readSource(
      "src/lib/shared/landing/components/launchpad/LaunchpadGrid.svelte"
    );
    const composer = readSource("src/routes/(public)/composer/+page.svelte");
    const notation = readSource("src/routes/(public)/notation/+page.svelte");
    const choreoCards = readSource(
      "src/routes/(public)/shop/choreography-cards/+page.svelte"
    );
    const anatomyExplainer = readSource(
      "src/lib/features/store/components/CardAnatomyExplainer.svelte"
    );
    const anatomy = readSource(
      "src/lib/features/store/components/CardAnatomy.svelte"
    );

    expect(homeHero).toContain("runAfterNamedRouteMorphIdle(heroAct.start)");
    expect(sequenceHero).toContain("use:activatePlayerWhenNear");
    expect(sequenceHero).toContain("!isNamedRouteMorphActive()");
    expect(launchpad).toContain("runAfterNamedRouteMorph(() =>");
    expect(launchpad).toContain("new Set(tiles.map((tile) => tile.id))");
    expect(launchpad).toContain("runAfterNamedRouteMorphIdle(mountNext");
    expect(launchpad).toContain("mediaLoadingId");
    expect(launchpad).toContain('typeof IntersectionObserver === "undefined"');
    expect(launchpad).toContain("active={mediaActive.has(tile.id)}");
    expect(launchpad).toContain("visible={visible.has(tile.id)}");
    expect(composer).toContain(
      'import { FALLBACK_DEMO } from "$lib/shared/landing/data/per-visit-demo"'
    );
    expect(composer).toContain(
      "let demoSeq = $state<SequenceData | null>(FALLBACK_DEMO)"
    );
    expect(composer).toContain(
      'await import("$lib/shared/landing/data/per-visit-demo")'
    );
    expect(composer).toContain("showNotationStrip={true}");
    expect(composer).toContain("showWordHeader={true}");
    expect(composer).toContain('loadPriority="immediate"');
    expect(sequenceHero).toContain(".with-notation-strip .demo-media");
    expect(choreoCards).toContain("runAfterNamedRouteMorphIdle(async () =>");
    expect(anatomyExplainer).toContain("use:activateCardsWhenNear");
    expect(anatomyExplainer).toContain("deferUntilIdle: true");
    expect(anatomyExplainer).toContain(
      'loader={() => import("./CardAnatomy.svelte")}'
    );
    expect(anatomy).not.toContain(
      'import { loadActiveProducts } from "../services/product-loader"'
    );
    expect(anatomy).toContain('await import("../services/product-loader")');
    // /notation used to lazy-load a shape-matrix teaser to keep it out of the
    // morph window. The 2026-07-27 rebuild dropped that component entirely, so
    // there is no heavy media left on the page to defer.
    expect(notation).not.toContain("ShapeMatrixTeaser");
  });

  it("keeps the Choreo Card preview truthful through catalog loading and failure", () => {
    const anatomyExplainer = readSource(
      "src/lib/features/store/components/CardAnatomyExplainer.svelte"
    );
    const anatomy = readSource(
      "src/lib/features/store/components/CardAnatomy.svelte"
    );

    expect(anatomyExplainer).toContain(
      'import SkeletonLoader from "$lib/shared/foundation/ui/SkeletonLoader.svelte"'
    );
    expect(anatomyExplainer).toContain('role="alert"');
    expect(anatomyExplainer).toContain('disabled={cardStatus !== "ready"}');
    expect(anatomyExplainer).toContain('class="card-placeholder-stack"');
    expect(anatomyExplainer).toContain("<figcaption>Front</figcaption>");
    expect(anatomyExplainer).toContain("<figcaption>Back</figcaption>");
    expect(anatomyExplainer).toContain("card-placeholder-shuffle");
    expect(anatomyExplainer).toContain(".card-load-failure :global(.skeleton)");
    expect(anatomyExplainer).toContain(".legend-row:hover:not(:disabled)");
    expect(anatomy).toContain("previewState");
    expect(anatomy).toContain('setPreviewState("loading")');
    expect(anatomy).toContain('setPreviewState("ready")');
    expect(anatomy).toContain('setPreviewState("error")');
    expect(anatomy).toContain("No active product has a baked card preview");
    expect(anatomy).toContain("retryCatalogExample");
    expect(anatomy).toContain("previewFootprint(false)");
    expect(anatomy).toContain(".preview-load-failure :global(.skeleton)");
  });

  it("gives nested Composer demos cancellable loading and local recovery", () => {
    const composer = readSource("src/routes/(public)/composer/+page.svelte");
    const generate = readSource(
      "src/routes/(public)/composer/_sections/GenerateSection.svelte"
    );
    const mandala = readSource(
      "src/routes/(public)/composer/_sections/MandalaSection.svelte"
    );
    const sequenceHero = readSource(
      "src/lib/shared/landing/components/SequenceHeroDemo.svelte"
    );

    expect(generate).toContain(
      "const cancelSeed = runAfterNamedRouteMorphIdle"
    );
    expect(generate).toContain("cancelSeed();");
    expect(generate).toContain("error={playerLoadError}");
    expect(generate).toContain("error={stripLoadError}");
    expect(mandala).toContain("This mandala did not load.");
    expect(composer).toContain("tunnelActive && demoError && !demoSeq");
    expect(composer).toContain("viewer3DActive && demoError && !demoSeq");
    expect(composer).toContain("false,\n      rerollingDemo");
    expect(sequenceHero).toContain("placeholder={playerPlaceholder}");
    expect(sequenceHero).toContain("onStatusChange={(status) =>");
  });

  it("keeps compact Composer demos in state-sharing tab panels", () => {
    const construct = readSource(
      "src/routes/(public)/composer/_sections/ConstructSection.svelte"
    );
    const generate = readSource(
      "src/routes/(public)/composer/_sections/GenerateSection.svelte"
    );

    for (const source of [construct, generate]) {
      expect(source).toContain('new MediaQuery("(max-width: 74.99rem)")');
      expect(source).toContain('semantics="tabs"');
      expect(source).toContain('role={isCompactDemo ? "tabpanel" : undefined}');
    }

    expect(construct).toContain(
      'hidden={isCompactDemo && compactPane !== "sequence"}'
    );
    expect(construct).toContain(
      'hidden={isCompactDemo && compactPane !== "build"}'
    );
    expect(generate).toContain(
      'hidden={isCompactDemo && compactView !== "result"}'
    );
    expect(generate).toContain(
      'hidden={isCompactDemo && compactView !== "recipe"}'
    );
    expect(generate).toContain("<summary>More settings</summary>");
    expect(generate).toContain("onclick={() => void generate(true)}");
  });

  it("keeps the verification corpus out of public notation route chunks", () => {
    const notation = readSource("src/routes/(public)/notation/+page.svelte");
    const loops = readSource("src/routes/(public)/notation/loops/+page.svelte");

    // The catalog stopped rendering a loop teaser when /notation was rebuilt as
    // a text catalog on 2026-07-27. Only the loops page still shows one — but
    // the corpus must stay out of BOTH chunks, which is the actual guard here.
    expect(loops).toContain("notation-loop-teaser");
    for (const source of [notation, loops]) {
      expect(source).not.toContain(
        'from "$lib/shared/loop-explorer/domain/curated-seeds"'
      );
    }
    expect(loops).toContain(
      'import("$lib/shared/loop-explorer/components/LoopExplorer.svelte")'
    );
    expect(loops).not.toContain(
      'import LoopExplorer from "$lib/shared/loop-explorer/components/LoopExplorer.svelte"'
    );

    const corpusBytes = statSync(
      resolve(
        process.cwd(),
        "src/lib/shared/loop-explorer/domain/curated-seeds.json"
      )
    ).size;
    const teaserBytes = statSync(
      resolve(
        process.cwd(),
        "src/lib/shared/loop-explorer/domain/notation-loop-teaser-seed.json"
      )
    ).size;

    expect(corpusBytes).toBeGreaterThan(1_000_000);
    expect(teaserBytes).toBeLessThan(12_000);
  });
});

describe("named route morph lifecycle", () => {
  it("queues nonessential work until the final active morph finishes", async () => {
    const first = deferred();
    const second = deferred();
    const work = vi.fn();

    runNamedRouteMorph(() => ({ finished: first.promise }));
    runNamedRouteMorph(() => ({ finished: second.promise }));
    runAfterNamedRouteMorph(work);

    first.resolve();
    await first.promise;
    await Promise.resolve();
    expect(work).not.toHaveBeenCalled();

    second.resolve();
    await second.promise;
    await Promise.resolve();
    expect(work).toHaveBeenCalledOnce();
  });

  it("runs immediately without a morph and honors cancellation while queued", async () => {
    const immediate = vi.fn();
    runAfterNamedRouteMorph(immediate);
    expect(immediate).toHaveBeenCalledOnce();

    const finish = deferred();
    const cancelled = vi.fn();
    runNamedRouteMorph(() => ({ finished: finish.promise }));
    const cancel = runAfterNamedRouteMorph(cancelled);
    cancel();

    finish.resolve();
    await finish.promise;
    await Promise.resolve();
    expect(cancelled).not.toHaveBeenCalled();
  });

  it("keeps expensive work behind both the morph and an idle turn", async () => {
    const finish = deferred();
    const work = vi.fn();
    let idleCallback: (() => void) | undefined;
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((callback: () => void) => {
        idleCallback = callback;
        return 1;
      })
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    runNamedRouteMorph(() => ({ finished: finish.promise }));
    runAfterNamedRouteMorphIdle(work);
    expect(work).not.toHaveBeenCalled();

    finish.resolve();
    await finish.promise;
    await Promise.resolve();
    expect(work).not.toHaveBeenCalled();

    idleCallback?.();
    expect(work).toHaveBeenCalledOnce();
  });

  it("re-arms queued idle work behind a newer morph", async () => {
    const idleCallbacks: Array<() => void> = [];
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((callback: () => void) => {
        idleCallbacks.push(callback);
        return idleCallbacks.length;
      })
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    const work = vi.fn();

    runAfterNamedRouteMorphIdle(work);
    expect(idleCallbacks).toHaveLength(1);

    const newerMorph = deferred();
    runNamedRouteMorph(() => ({ finished: newerMorph.promise }));
    idleCallbacks.shift()?.();
    expect(work).not.toHaveBeenCalled();
    expect(idleCallbacks).toHaveLength(0);

    newerMorph.resolve();
    await newerMorph.promise;
    await Promise.resolve();
    expect(idleCallbacks).toHaveLength(1);
    expect(work).not.toHaveBeenCalled();

    idleCallbacks.shift()?.();
    expect(work).toHaveBeenCalledOnce();
  });

  it("isolates deferred subscribers so one failure does not block the rest", async () => {
    const finish = deferred();
    const first = vi.fn(() => {
      throw new Error("deferred enhancement failed");
    });
    const second = vi.fn();
    const queuedErrors: Array<() => void> = [];
    vi.stubGlobal(
      "queueMicrotask",
      vi.fn((callback: () => void) => queuedErrors.push(callback))
    );

    runNamedRouteMorph(() => ({ finished: finish.promise }));
    runAfterNamedRouteMorph(first);
    runAfterNamedRouteMorph(second);
    finish.resolve();
    await finish.promise;
    await Promise.resolve();

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(queuedErrors.length).toBeGreaterThan(0);
  });

  it("holds the root guard and chrome ownership until the transition finishes", async () => {
    const finish = deferred();
    runNamedRouteMorph(() => ({ finished: finish.promise }));

    expect(isNamedRouteMorphActive()).toBe(true);
    expect(
      document.documentElement.classList.contains(NAMED_ROUTE_MORPH_CLASS)
    ).toBe(true);

    finish.resolve();
    await finish.promise;
    await Promise.resolve();

    expect(isNamedRouteMorphActive()).toBe(false);
    expect(
      document.documentElement.classList.contains(NAMED_ROUTE_MORPH_CLASS)
    ).toBe(false);
  });

  it("releases ownership after asynchronous rejection or synchronous startup failure", async () => {
    const finish = deferred();
    runNamedRouteMorph(() => ({ finished: finish.promise }));
    finish.reject();
    await finish.promise.catch(() => undefined);
    await Promise.resolve();
    expect(isNamedRouteMorphActive()).toBe(false);

    expect(() =>
      runNamedRouteMorph(() => {
        throw new Error("startViewTransition failed");
      })
    ).toThrow("startViewTransition failed");
    expect(isNamedRouteMorphActive()).toBe(false);
    expect(
      document.documentElement.classList.contains(NAMED_ROUTE_MORPH_CLASS)
    ).toBe(false);
  });

  it("does not let a superseded transition release a newer morph", async () => {
    const first = deferred();
    const second = deferred();
    runNamedRouteMorph(() => ({ finished: first.promise }));
    runNamedRouteMorph(() => ({ finished: second.promise }));

    first.resolve();
    await first.promise;
    await Promise.resolve();
    expect(isNamedRouteMorphActive()).toBe(true);
    expect(
      document.documentElement.classList.contains(NAMED_ROUTE_MORPH_CLASS)
    ).toBe(true);

    second.resolve();
    await second.promise;
    await Promise.resolve();
    expect(isNamedRouteMorphActive()).toBe(false);
  });

  it("keeps an older morph guarded when a newer start fails synchronously", async () => {
    const first = deferred();
    runNamedRouteMorph(() => ({ finished: first.promise }));

    expect(() =>
      runNamedRouteMorph(() => {
        throw new Error("second transition failed");
      })
    ).toThrow("second transition failed");
    expect(isNamedRouteMorphActive()).toBe(true);
    expect(
      document.documentElement.classList.contains(NAMED_ROUTE_MORPH_CLASS)
    ).toBe(true);

    first.resolve();
    await first.promise;
    await Promise.resolve();
    expect(isNamedRouteMorphActive()).toBe(false);
  });
});
