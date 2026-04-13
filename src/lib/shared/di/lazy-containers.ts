/**
 * Lazy Container Registry
 *
 * Each lazy container is loaded on-demand via dynamic import.
 * Results are cached — subsequent calls return the same instance.
 */

const _cache = new Map<string, unknown>();

async function _loadOnce<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const cached = _cache.get(key);
  if (cached) return cached as T;
  const instance = await factory();
  _cache.set(key, instance);
  return instance;
}

export function getPoiLabItems() {
  return _loadOnce("poi-lab", async () => {
    const { createPoiLabContainer } = await import("./containers/poi-lab-container");
    return createPoiLabContainer().items;
  });
}

export function getCollisionLabItems() {
  return _loadOnce("collision-lab", async () => {
    const { createCollisionLabContainer } = await import("./containers/collision-lab-container");
    return createCollisionLabContainer().items;
  });
}

export function getMuseumItems() {
  return _loadOnce("museum", async () => {
    const { createMuseumContainer } = await import("./containers/museum-container");
    return createMuseumContainer().items;
  });
}

export function getFestivalItems() {
  return _loadOnce("festival", async () => {
    const { festivalContainer } = await import("./containers/festival-container");
    return festivalContainer.items;
  });
}

export function getStoreItems() {
  return _loadOnce("store", async () => {
    const { createStoreContainer } = await import("./containers/store-container");
    return createStoreContainer().items;
  });
}

export function getHallOfShameItems() {
  return _loadOnce("hall-of-shame", async () => {
    const { createHallOfShameContainer } = await import("./containers/hall-of-shame-container");
    return createHallOfShameContainer().items;
  });
}

export function getArenaItems() {
  return _loadOnce("arena", async () => {
    const { arenaContainer } = await import("./containers/arena-container");
    return arenaContainer.items;
  });
}

export function getSkel2TKAItems() {
  return _loadOnce("skel2tka", async () => {
    const { createSkel2TKAContainer } = await import("./containers/skel2tka-container");
    return createSkel2TKAContainer().items;
  });
}

export function getComposeBrowseItems() {
  return _loadOnce("compose-browse", async () => {
    const { createComposeBrowseContainer } = await import("./containers/compose-browse-container");
    return createComposeBrowseContainer().items;
  });
}

export function getComposeArrangeItems() {
  return _loadOnce("compose-arrange", async () => {
    const { createComposeArrangeContainer } = await import("./containers/compose-arrange-container");
    return createComposeArrangeContainer().items;
  });
}

export function getEffectsLabItems() {
  return _loadOnce("effects-lab", async () => {
    const { effectsLabContainer } = await import("./containers/effects-lab-container");
    return effectsLabContainer.items;
  });
}

export function getVideoTrailsItems() {
  return _loadOnce("video-trails", async () => {
    const { videoTrailsContainer } = await import("./containers/video-trails-container");
    return videoTrailsContainer.items;
  });
}

export function getVideoInfraItems() {
  return _loadOnce("video-infra", async () => {
    const { videoInfraContainer } = await import("./containers/video-infra-container");
    return videoInfraContainer.items;
  });
}

export function getTrigridLabItems() {
  return _loadOnce("trigrid-lab", async () => {
    const { trigridLabContainer } = await import("./containers/trigrid-lab-container");
    return trigridLabContainer.items;
  });
}

export function getMultiGridItems() {
  return _loadOnce("multi-grid", async () => {
    const { multiGridContainer } = await import("./containers/multi-grid-container");
    return multiGridContainer.items;
  });
}

export function getLabItems() {
  return _loadOnce("lab", async () => {
    const { labContainer } = await import("./containers/lab-container");
    return labContainer.items;
  });
}

export function getAssembleItems() {
  return _loadOnce("assemble", async () => {
    const { assembleContainer } = await import("./containers/assemble-container");
    return assembleContainer.items;
  });
}

export function getFuseItems() {
  return _loadOnce("fuse", async () => {
    const { fuseContainer } = await import("./containers/fuse-container");
    return fuseContainer.items;
  });
}

export function getPoiItems() {
  return _loadOnce("poi", async () => {
    const { createPoiContainer } = await import("./containers/poi-container");
    return createPoiContainer().items;
  });
}

export function getLandingPreviewItems() {
  return _loadOnce("landing-preview", async () => {
    const { createLandingPreviewContainer } = await import("./containers/landing-preview-container");
    return createLandingPreviewContainer().items;
  });
}
