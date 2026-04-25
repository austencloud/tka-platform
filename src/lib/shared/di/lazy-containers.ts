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

// getSkel2TKAItems removed — skel2tka-container dissolved into module singleton getters

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

export function getMultiGridItems() {
  return _loadOnce("multi-grid", async () => {
    const { multiGridContainer } = await import("./containers/multi-grid-container");
    return multiGridContainer.items;
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
