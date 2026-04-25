/**
 * Lazy Service Registry
 *
 * Provides lazy-loaded access to feature services via dynamic imports
 * of their module singleton getters. Results are cached — subsequent
 * calls return the same resolved value.
 *
 * All containers have been dissolved. These functions now dynamically
 * import the individual getter modules for code-splitting.
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
    const [
      { getPoiGravityOrientationDeriver },
      { getVTGTerminologyMapper },
      { getPoiConstraintValidator },
      { getPoiSequenceValidator },
      { getPoiOptionFilterDecorator },
    ] = await Promise.all([
      import("$lib/features/poi-lab/getPoiGravityOrientationDeriver"),
      import("$lib/features/poi-lab/getVTGTerminologyMapper"),
      import("$lib/features/poi-lab/getPoiConstraintValidator"),
      import("$lib/features/poi-lab/getPoiSequenceValidator"),
      import("$lib/features/poi-lab/getPoiOptionFilterDecorator"),
    ]);
    return {
      poiGravityOrientationDeriver: getPoiGravityOrientationDeriver(),
      vtgTerminologyMapper: getVTGTerminologyMapper(),
      poiConstraintValidator: getPoiConstraintValidator(),
      poiSequenceValidator: getPoiSequenceValidator(),
      poiOptionFilterDecorator: getPoiOptionFilterDecorator(),
    };
  });
}

export function getCollisionLabItems() {
  return _loadOnce("collision-lab", async () => {
    const [
      { getDiamondPoseEnumerator },
      { getCollisionLabPoseLabelRepository },
      { getStanceSimulator },
      { getStanceOptimizer },
      { getStanceCandidateGenerator },
    ] = await Promise.all([
      import("$lib/features/lab/tabs/collision-lab/getDiamondPoseEnumerator"),
      import("$lib/features/lab/tabs/collision-lab/getCollisionLabPoseLabelRepository"),
      import("$lib/features/lab/tabs/collision-lab/getStanceSimulator"),
      import("$lib/features/lab/tabs/collision-lab/getStanceOptimizer"),
      import("$lib/features/lab/tabs/collision-lab/getStanceCandidateGenerator"),
    ]);
    return {
      diamondPoseEnumerator: getDiamondPoseEnumerator(),
      collisionLabPoseLabelRepository: getCollisionLabPoseLabelRepository(),
      stanceSimulator: getStanceSimulator(),
      stanceOptimizer: getStanceOptimizer(),
      stanceCandidateGenerator: getStanceCandidateGenerator(),
    };
  });
}

export function getMuseumItems() {
  return _loadOnce("museum", async () => {
    const [
      { getMuseumPersister },
      { getInteractionDetector },
    ] = await Promise.all([
      import("$lib/features/museum/getMuseumPersister"),
      import("$lib/features/museum/getInteractionDetector"),
    ]);
    return {
      museumPersister: getMuseumPersister(),
      interactionDetector: getInteractionDetector(),
    };
  });
}

export function getStoreItems() {
  return _loadOnce("store", async () => {
    const [
      { getProductLoader },
      { getMerchCheckoutCreator },
    ] = await Promise.all([
      import("$lib/features/store/getProductLoader"),
      import("$lib/features/store/getMerchCheckoutCreator"),
    ]);
    return {
      productLoader: getProductLoader(),
      merchCheckoutCreator: getMerchCheckoutCreator(),
    };
  });
}

export function getHallOfShameItems() {
  return _loadOnce("hall-of-shame", async () => {
    const [
      { getAgeVerifier },
      { getHallOfShameSubmitter },
      { getHallOfShameLoader },
      { getHallOfShameVoter },
      { getShameQueueManager },
    ] = await Promise.all([
      import("$lib/features/hall-of-shame/getAgeVerifier"),
      import("$lib/features/hall-of-shame/getHallOfShameSubmitter"),
      import("$lib/features/hall-of-shame/getHallOfShameLoader"),
      import("$lib/features/hall-of-shame/getHallOfShameVoter"),
      import("$lib/features/hall-of-shame/getShameQueueManager"),
    ]);
    return {
      ageVerifier: getAgeVerifier(),
      hallOfShameSubmitter: getHallOfShameSubmitter(),
      hallOfShameLoader: getHallOfShameLoader(),
      hallOfShameVoter: getHallOfShameVoter(),
      shameQueueManager: getShameQueueManager(),
    };
  });
}

export function getComposeBrowseItems() {
  return _loadOnce("compose-browse", async () => {
    const [
      { getCompositionLayoutCalculator },
      { getCompositionThumbnailResolver },
    ] = await Promise.all([
      import("$lib/features/compose/tabs/browse/getCompositionLayoutCalculator"),
      import("$lib/features/compose/tabs/browse/getCompositionThumbnailResolver"),
    ]);
    return {
      compositionLayoutCalculator: getCompositionLayoutCalculator(),
      compositionThumbnailResolver: getCompositionThumbnailResolver(),
    };
  });
}

export function getComposeArrangeItems() {
  return _loadOnce("compose-arrange", async () => {
    const [
      { getArrangeBeatCalculator },
      { getArrangeGridPersister },
      { getArrangePlaybackEngine },
      { getArrangeLayerTransformer },
      { getArrangeKeyboardHandler },
      { getCellTransformStack },
    ] = await Promise.all([
      import("$lib/features/compose/tabs/arrange/getArrangeBeatCalculator"),
      import("$lib/features/compose/tabs/arrange/getArrangeGridPersister"),
      import("$lib/features/compose/tabs/arrange/getArrangePlaybackEngine"),
      import("$lib/features/compose/tabs/arrange/getArrangeLayerTransformer"),
      import("$lib/features/compose/tabs/arrange/getArrangeKeyboardHandler"),
      import("$lib/features/compose/tabs/arrange/getCellTransformStack"),
    ]);
    return {
      arrangeBeatCalculator: getArrangeBeatCalculator(),
      arrangeGridPersister: getArrangeGridPersister(),
      arrangePlaybackEngine: getArrangePlaybackEngine(),
      arrangeLayerTransformer: getArrangeLayerTransformer(),
      arrangeKeyboardHandler: getArrangeKeyboardHandler(),
      cellTransformStack: getCellTransformStack(),
    };
  });
}

export function getVideoTrailsItems() {
  return _loadOnce("video-trails", async () => {
    const [
      { getLedThresholdDetector },
      { getColorEndpointDetector },
      { getVideoTipAdapter },
      { getDetectionCorrector },
      { getVideoTrailsRepository },
      { getVideoTrailsExporter },
      { getEffectConfigMapper },
    ] = await Promise.all([
      import("$lib/features/video/video-trails/getLedThresholdDetector"),
      import("$lib/features/video/video-trails/getColorEndpointDetector"),
      import("$lib/features/video/video-trails/getVideoTipAdapter"),
      import("$lib/features/video/video-trails/getDetectionCorrector"),
      import("$lib/features/video/video-trails/getVideoTrailsRepository"),
      import("$lib/features/video/video-trails/getVideoTrailsExporter"),
      import("$lib/features/video/video-trails/getEffectConfigMapper"),
    ]);
    return {
      ledThresholdDetector: getLedThresholdDetector(),
      colorEndpointDetector: getColorEndpointDetector(),
      videoTipAdapter: getVideoTipAdapter(),
      detectionCorrector: getDetectionCorrector(),
      videoTrailsRepository: getVideoTrailsRepository(),
      videoTrailsExporter: getVideoTrailsExporter(),
      effectConfigMapper: getEffectConfigMapper(),
    };
  });
}

export function getVideoInfraItems() {
  return _loadOnce("video-infra", async () => {
    const [
      { getVideoSourceProvider },
      { getTrainingDataStore },
      { getFrameExtractor },
    ] = await Promise.all([
      import("$lib/shared/video/getVideoSourceProvider"),
      import("$lib/shared/video/getTrainingDataStore"),
      import("$lib/shared/video/getFrameExtractor"),
    ]);
    return {
      videoSourceProvider: getVideoSourceProvider(),
      trainingDataStore: getTrainingDataStore(),
      frameExtractor: getFrameExtractor(),
    };
  });
}

export function getMultiGridItems() {
  return _loadOnce("multi-grid", async () => {
    const [
      { getGridGeometry },
      { getTopologyBuilder },
      { getTopologyRenderer },
      { getTopologyPositionEnumerator },
      { getTopologyPropLoader },
      { getTopologyBetaSeparator },
    ] = await Promise.all([
      import("$lib/shared/multi-grid/getGridGeometry"),
      import("$lib/shared/multi-grid/getTopologyBuilder"),
      import("$lib/shared/multi-grid/getTopologyRenderer"),
      import("$lib/shared/multi-grid/getTopologyPositionEnumerator"),
      import("$lib/shared/multi-grid/getTopologyPropLoader"),
      import("$lib/shared/multi-grid/getTopologyBetaSeparator"),
    ]);
    return {
      gridGeometry: getGridGeometry(),
      topologyBuilder: getTopologyBuilder(),
      topologyRenderer: getTopologyRenderer(),
      topologyPositionEnumerator: getTopologyPositionEnumerator(),
      topologyPropLoader: getTopologyPropLoader(),
      topologyBetaSeparator: getTopologyBetaSeparator(),
    };
  });
}

export function getPoiItems() {
  return _loadOnce("poi", async () => {
    const [
      { getImagePatternLoader },
      { getOpenPixelPoiAdapter },
      { getPoiImageLibrary },
      { getStripPatternEngine },
      { getPoiDeviceManager },
    ] = await Promise.all([
      import("$lib/features/poi/getImagePatternLoader"),
      import("$lib/features/poi/getOpenPixelPoiAdapter"),
      import("$lib/features/poi/getPoiImageLibrary"),
      import("$lib/features/poi/getStripPatternEngine"),
      import("$lib/features/poi/getPoiDeviceManager"),
    ]);
    return {
      imagePatternLoader: getImagePatternLoader(),
      openPixelPoiAdapter: getOpenPixelPoiAdapter(),
      poiImageLibrary: getPoiImageLibrary(),
      stripPatternEngine: getStripPatternEngine(),
      poiDeviceManager: getPoiDeviceManager(),
    };
  });
}

export function getLandingPreviewItems() {
  return _loadOnce("landing-preview", async () => {
    const [
      { getVideoCuratorLoader },
      { getVideoCuratorPersister },
      { getSequenceMatcher },
    ] = await Promise.all([
      import("$lib/features/landing-preview/getVideoCuratorLoader"),
      import("$lib/features/landing-preview/getVideoCuratorPersister"),
      import("$lib/features/landing-preview/getSequenceMatcher"),
    ]);
    return {
      videoCuratorLoader: getVideoCuratorLoader(),
      videoCuratorPersister: getVideoCuratorPersister(),
      sequenceMatcher: getSequenceMatcher(),
    };
  });
}
