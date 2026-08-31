import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const avatarSource = readFileSync(
  resolve(
    "node_modules/@austencloud/scene-3d/src/lib/components/Avatar3D.svelte"
  ),
  "utf8"
);
const skeletonSource = readFileSync(
  resolve(
    "node_modules/@austencloud/scene-3d/src/lib/services/implementations/AvatarSkeletonBuilder.ts"
  ),
  "utf8"
);
const cacheSource = readFileSync(
  resolve(
    "node_modules/@austencloud/scene-3d/src/lib/services/shared-gltf-cache.ts"
  ),
  "utf8"
);
const hubSource = readFileSync(
  resolve("src/lib/shared/3d/components/controls/PerformerHubDetail.svelte"),
  "utf8"
);
// The performer command bar (954f5c4a49) moved the avatar list markup out of
// the hub and into this picker. The hub still owns the intent/commit logic and
// hands the picker its callbacks, so the budget contract spans both files.
const pickerSource = readFileSync(
  resolve("src/lib/shared/3d/components/controls/PerformerAvatarPicker.svelte"),
  "utf8"
);

describe("avatar swap render budget", () => {
  it("prepares avatar data when pointer or keyboard intent is known", () => {
    expect(hubSource).toContain(
      "prepareAvatarForDisplay(getAvatarModelPath(id))"
    );
    expect(hubSource).toContain("queueAvatarSelectionIntent");
    // The hub wires its intent handlers into the picker...
    expect(hubSource).toContain("onIntent={queueAvatarSelectionIntent}");
    expect(hubSource).toContain("onCancelIntent={cancelAvatarSelectionIntent}");
    // ...and the picker binds them to the pointer and focus pair, so an intent
    // that never becomes a selection is always withdrawn.
    expect(pickerSource).toContain(
      "onpointerenter={() => startPointerPreview("
    );
    expect(pickerSource).toContain("onpointerleave={() => stopPointerPreview(");
    expect(pickerSource).toContain("onfocus={() => startFocusPreview(");
    expect(pickerSource).toContain("onblur={() => stopFocusPreview(");
    expect(pickerSource).toContain("function startPointerPreview");
    expect(pickerSource).toContain("function startFocusPreview");
    expect(pickerSource).toContain("onIntent(id)");
    expect(pickerSource).toContain("onCancelIntent()");
  });

  it("keeps the current avatar visible until its replacement is prepared", () => {
    // The commit path awaits the prepare — the fire-and-forget
    // `void prepareAvatarSelection(id)` is the hover-intent warmup, a
    // different call site that sits further down the file.
    const prepareSelection = hubSource.indexOf(
      "await prepareAvatarSelection(id)"
    );
    // The live viewer groups an All-Performers swap into one undo entry. The
    // director still receives the same host-owned edit through onPerformerEdit.
    const commitSelection = hubSource.indexOf(
      "viewer.setAvatarModelScoped(id)",
      prepareSelection
    );

    expect(prepareSelection).toBeGreaterThan(-1);
    expect(commitSelection).toBeGreaterThan(prepareSelection);
    expect(hubSource).toContain('field: "avatarId"');
    expect(hubSource).toContain("pendingAvatarId = id");
    // The pending flag crosses into the picker, which paints the slot it marks.
    expect(hubSource).toContain("{pendingAvatarId}");
    expect(pickerSource).toContain(
      "class:preparing={pendingAvatarId === definition.id}"
    );
  });

  it("compiles active material variants before committing the replacement root", () => {
    const opaqueWarmup = avatarSource.indexOf("applyModelOpacity(nextRoot, 1)");
    const fadeWarmup = avatarSource.indexOf(
      "applyModelOpacity(nextRoot, opacity)",
      opaqueWarmup
    );
    const rootCommit = avatarSource.indexOf(
      "cachedRoot = nextRoot",
      fadeWarmup
    );

    expect(avatarSource).toContain("renderer.compileAsync");
    expect(avatarSource).toContain("activeCamera && !rendererPrepared");
    expect(opaqueWarmup).toBeGreaterThan(-1);
    expect(fadeWarmup).toBeGreaterThan(opaqueWarmup);
    expect(rootCommit).toBeGreaterThan(fadeWarmup);
  });

  it("restores authored transparent materials after the swap fade", () => {
    expect(avatarSource).toContain(
      "const authoredMaterialAppearances = new WeakMap"
    );
    expect(avatarSource).toContain("transparent: material.transparent");
    expect(avatarSource).toContain("opacity: material.opacity");
    expect(avatarSource).toContain("depthWrite: material.depthWrite");
    expect(avatarSource).toContain(
      "const transparent = isFading || authored.transparent"
    );
    expect(avatarSource).toContain(
      "material.opacity = authored.opacity * fadeOpacity"
    );
    expect(avatarSource).toContain(
      "material.depthWrite = isFading ? false : authored.depthWrite"
    );
    expect(avatarSource).not.toContain("material.depthWrite = !transparent");
  });

  it("keeps outgoing materials alive through renderer preparation", () => {
    const deferDisposal = skeletonSource.indexOf(
      "this.replacedRoots.push(oldRoot)"
    );
    const finalizer = skeletonSource.indexOf("finalizeModelSwap(): void");
    const rootCommit = avatarSource.indexOf("cachedRoot = nextRoot");
    const scheduleFinalize = avatarSource.indexOf(
      "finalizeModelSwapAfterPaint();",
      rootCommit
    );

    expect(deferDisposal).toBeGreaterThan(-1);
    expect(finalizer).toBeGreaterThan(deferDisposal);
    expect(scheduleFinalize).toBeGreaterThan(rootCommit);
    expect(avatarSource).toContain("skeletonService?.finalizeModelSwap()");
    expect(skeletonSource).not.toContain(
      "queueMicrotask(() => this.disposeInstanceResources(oldRoot))"
    );
  });

  it("transfers the exact GPU-prepared clone into the visible skeleton", () => {
    expect(cacheSource).toContain("export function takePreparedAvatarRoot");
    expect(avatarSource).toContain("takePreparedAvatarRoot(url, renderer)");
    expect(avatarSource).toContain(
      "skeletonService!.loadModel(url, preparedRoot ?? undefined)"
    );
    // loadModel split the old `preparedRoot ?? clone(...)` ternary into an
    // if/else so the cold path can time its clone. Same contract: a prepared
    // root is handed straight through, and cloning happens only without one.
    const usesPrepared = skeletonSource.indexOf("root = preparedRoot;");
    const coldClone = skeletonSource.indexOf(
      "root = cloneSharedSkinnedScene(gltf.scene);"
    );
    expect(usesPrepared).toBeGreaterThan(-1);
    expect(coldClone).toBeGreaterThan(usesPrepared);
    expect(cacheSource).toContain("context.renderer.initTexture(texture)");
  });

  it("skips redundant compile work after the same renderer has prepared the URL", () => {
    expect(cacheSource).toContain("context.preparedUrls.add(url)");
    expect(cacheSource).toContain(
      "export function isAvatarPreparedForRenderer"
    );
    expect(avatarSource).toContain(
      "isAvatarPreparedForRenderer(url, renderer)"
    );
  });

  it("reuses source-pose bounds instead of traversing the selected clone", () => {
    expect(cacheSource).toContain("avatarBounds.set(url");
    expect(cacheSource).toContain("export function getSharedGltfBounds");
    expect(skeletonSource).toContain("getSharedGltfBounds(url)");
    expect(skeletonSource).toContain("if (preparedBounds)");
  });

  it("never mutates the live framebuffer while preparing hover intent", () => {
    expect(cacheSource).not.toContain("setRenderTarget(");
    expect(cacheSource).not.toContain("renderer.render(context.warmScene");
    expect(cacheSource).not.toContain("WebGLRenderTarget");
  });

  it("fits production avatar textures to the interactive display budget", () => {
    expect(cacheSource).toContain("MAX_AVATAR_TEXTURE_DIMENSION = 1024");
    expect(cacheSource).toContain(
      "fitAvatarTexturesToDisplayBudget(gltf.scene)"
    );
    expect(cacheSource).toContain('resizeQuality: "high"');
  });
});
