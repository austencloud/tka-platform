import { Matrix4 } from "three";
import { mapCompositionBeat } from "../domain/motion-composition-time";
import {
  composeSpatialTransform,
  decomposeSpatialTransform,
  IDENTITY_TRANSFORM,
  interpolateSpatialTransform,
  interpolateVector3,
  matrix4Tuple,
  quaternionFromUpDirection,
  transformEndpoint,
  worldLockedLocalTransform,
} from "../domain/motion-composition-transform";
import type {
  CoordinateNode,
  LocalPropFrame,
  MotionClip,
  MotionCompositionFrame,
  MotionCompositionSamplingAdapters,
  MotionCompositionV3,
  PropStream,
  SampledCoordinateNode,
  SampledPropStream,
  SpatialCameraFrame,
  SpatialCameraKeyframe,
  SpatialEndpoint,
  SpatialPropKeyframe,
  SpatialTransform,
  SpatialTransformKeyframe,
  SpatialTransformTrack,
} from "../domain/motion-composition-types";

interface KeyframeInterval<T extends { beat: number }> {
  from: T;
  to: T;
  progress: number;
}

function keyframeInterval<T extends { beat: number }>(
  keyframes: readonly T[],
  beat: number,
  subject: string
): KeyframeInterval<T> {
  if (keyframes.length === 0) {
    throw new Error(`${subject} has no keyframes`);
  }

  for (let index = 1; index < keyframes.length; index += 1) {
    if (keyframes[index]!.beat <= keyframes[index - 1]!.beat) {
      throw new Error(`${subject} keyframes must use increasing beat values`);
    }
  }

  const first = keyframes[0]!;
  if (beat <= first.beat) return { from: first, to: first, progress: 0 };
  const last = keyframes[keyframes.length - 1]!;
  if (beat >= last.beat) return { from: last, to: last, progress: 0 };

  for (let index = 1; index < keyframes.length; index += 1) {
    const to = keyframes[index]!;
    if (beat <= to.beat) {
      const from = keyframes[index - 1]!;
      const span = to.beat - from.beat;
      return {
        from,
        to,
        progress: span <= 0 ? 0 : (beat - from.beat) / span,
      };
    }
  }

  return { from: last, to: last, progress: 0 };
}

function sampleTransformKeyframes(
  keyframes: readonly SpatialTransformKeyframe[],
  beat: number
): SpatialTransform {
  const interval = keyframeInterval(keyframes, beat, "Transform track");
  return interpolateSpatialTransform(
    interval.from.transform,
    interval.to.transform,
    interval.progress
  );
}

function interpolateEndpoints(
  from: readonly SpatialEndpoint[],
  to: readonly SpatialEndpoint[],
  progress: number
): SpatialEndpoint[] {
  const toById = new Map(to.map((endpoint) => [endpoint.id, endpoint]));
  if (
    from.length !== to.length ||
    from.some((endpoint) => !toById.has(endpoint.id))
  ) {
    throw new Error(
      "Spatial prop endpoint IDs must remain stable between keyframes"
    );
  }

  return from.map((endpoint) => ({
    id: endpoint.id,
    position: interpolateVector3(
      endpoint.position,
      toById.get(endpoint.id)!.position,
      progress
    ),
  }));
}

function samplePropKeyframes(
  keyframes: readonly SpatialPropKeyframe[],
  beat: number
): LocalPropFrame {
  const interval = keyframeInterval(keyframes, beat, "Spatial prop channel");
  return {
    transform: interpolateSpatialTransform(
      interval.from.transform,
      interval.to.transform,
      interval.progress
    ),
    endpoints: interpolateEndpoints(
      interval.from.endpoints,
      interval.to.endpoints,
      interval.progress
    ),
  };
}

function sampleBuiltInTransformTrack(
  track: SpatialTransformTrack,
  localBeat: number
): SpatialTransform | undefined {
  if (track.kind === "identity") return { ...IDENTITY_TRANSFORM };
  if (track.kind === "keyframes") {
    return sampleTransformKeyframes(track.keyframes, localBeat);
  }
  return undefined;
}

function sampleBuiltInClip(
  clip: MotionClip,
  channelId: string,
  localBeat: number
): LocalPropFrame | undefined {
  if (clip.kind !== "spatial-keyframes") return undefined;
  const channel = clip.channels.find((candidate) => candidate.id === channelId);
  if (!channel) {
    throw new Error(`Spatial clip does not contain channel ${channelId}`);
  }
  return samplePropKeyframes(channel.keyframes, localBeat);
}

function resolveTransformTrack(
  track: SpatialTransformTrack,
  localBeat: number,
  adapters: MotionCompositionSamplingAdapters
): SpatialTransform {
  const adapted = adapters.sampleTransformTrack?.(track, localBeat);
  const sampled = adapted ?? sampleBuiltInTransformTrack(track, localBeat);
  if (!sampled) {
    throw new Error(
      `Transform track ${track.kind} requires a registered sampling adapter`
    );
  }
  return sampled;
}

function resolveClip(
  clip: MotionClip,
  stream: PropStream,
  localBeat: number,
  adapters: MotionCompositionSamplingAdapters
): LocalPropFrame {
  const adapted = adapters.sampleClip?.(clip, stream, localBeat);
  const sampled =
    adapted ?? sampleBuiltInClip(clip, stream.channelId, localBeat);
  if (!sampled) {
    throw new Error(`Clip ${clip.kind} requires a registered sampling adapter`);
  }
  return sampled;
}

function sampleOrientedNodeTransform(
  node: CoordinateNode,
  compositionBeat: number,
  parentWorld: Matrix4,
  adapters: MotionCompositionSamplingAdapters
): { localBeat: number; transform: SpatialTransform } {
  const localBeat = mapCompositionBeat(
    compositionBeat,
    node.transform.durationBeats,
    node.time
  );
  const sampled = resolveTransformTrack(node.transform, localBeat, adapters);

  if (node.orientationMode === "rigid") {
    return { localBeat, transform: sampled };
  }
  if (node.orientationMode === "position-only") {
    return {
      localBeat,
      transform: {
        translation: sampled.translation,
        rotation: IDENTITY_TRANSFORM.rotation,
        scale: IDENTITY_TRANSFORM.scale,
      },
    };
  }
  if (node.orientationMode === "world") {
    return {
      localBeat,
      transform: worldLockedLocalTransform(parentWorld, sampled),
    };
  }

  const nextLocalBeat = mapCompositionBeat(
    compositionBeat + 0.000_1,
    node.transform.durationBeats,
    node.time
  );
  const next = resolveTransformTrack(node.transform, nextLocalBeat, adapters);
  let direction = sampled.translation;
  if (node.orientationMode === "tangent") {
    const forward = [
      next.translation[0] - sampled.translation[0],
      next.translation[1] - sampled.translation[1],
      next.translation[2] - sampled.translation[2],
    ] as const;
    const forwardLengthSquared =
      forward[0] ** 2 + forward[1] ** 2 + forward[2] ** 2;
    if (forwardLengthSquared > 1e-12) {
      direction = forward;
    } else {
      const previousLocalBeat = mapCompositionBeat(
        compositionBeat - 0.000_1,
        node.transform.durationBeats,
        node.time
      );
      const previous = resolveTransformTrack(
        node.transform,
        previousLocalBeat,
        adapters
      );
      direction = [
        sampled.translation[0] - previous.translation[0],
        sampled.translation[1] - previous.translation[1],
        sampled.translation[2] - previous.translation[2],
      ] as const;
    }
  }

  return {
    localBeat,
    transform: {
      translation: sampled.translation,
      rotation: quaternionFromUpDirection(direction, sampled.rotation),
      scale: sampled.scale,
    },
  };
}

function sampleCameraProjection(
  from: SpatialCameraFrame["projection"],
  to: SpatialCameraFrame["projection"],
  progress: number
): SpatialCameraFrame["projection"] {
  if (from.kind !== to.kind) return progress < 1 ? from : to;
  if (from.kind === "perspective" && to.kind === "perspective") {
    const mix = (a: number, b: number): number => a + (b - a) * progress;
    return {
      kind: "perspective",
      fovDegrees: mix(from.fovDegrees, to.fovDegrees),
      aspect: mix(from.aspect, to.aspect),
      near: mix(from.near, to.near),
      far: mix(from.far, to.far),
    };
  }
  if (from.kind === "orthographic" && to.kind === "orthographic") {
    const mix = (a: number, b: number): number => a + (b - a) * progress;
    return {
      kind: "orthographic",
      left: mix(from.left, to.left),
      right: mix(from.right, to.right),
      top: mix(from.top, to.top),
      bottom: mix(from.bottom, to.bottom),
      near: mix(from.near, to.near),
      far: mix(from.far, to.far),
    };
  }
  return from;
}

function sampleCameraKeyframes(
  keyframes: readonly SpatialCameraKeyframe[],
  beat: number
): SpatialCameraFrame {
  const interval = keyframeInterval(keyframes, beat, "Camera track");
  return {
    position: interpolateVector3(
      interval.from.position,
      interval.to.position,
      interval.progress
    ),
    target: interpolateVector3(
      interval.from.target,
      interval.to.target,
      interval.progress
    ),
    up: interpolateVector3(interval.from.up, interval.to.up, interval.progress),
    projection: sampleCameraProjection(
      interval.from.projection,
      interval.to.projection,
      interval.progress
    ),
  };
}

export function sampleMotionCompositionAt(
  composition: MotionCompositionV3,
  beat: number,
  adapters: MotionCompositionSamplingAdapters = {}
): MotionCompositionFrame {
  const sampledNodes: Record<string, SampledCoordinateNode> = {};
  const sampledStreams: Record<string, SampledPropStream> = {};
  const activeNodes = new Set<string>();
  const visitedNodes = new Set<string>();

  const visitNode = (
    nodeId: string,
    expectedParentId: string | null,
    parentWorld: Matrix4
  ): void => {
    if (activeNodes.has(nodeId)) {
      throw new Error(`Coordinate node cycle detected at ${nodeId}`);
    }
    if (visitedNodes.has(nodeId)) {
      throw new Error(
        `Coordinate node ${nodeId} appears more than once in the tree`
      );
    }

    const node = composition.nodes[nodeId];
    if (!node) throw new Error(`Missing coordinate node ${nodeId}`);
    if (node.parentId !== expectedParentId) {
      throw new Error(
        `Coordinate node ${nodeId} declares parent ${node.parentId ?? "null"}, expected ${expectedParentId ?? "null"}`
      );
    }

    activeNodes.add(nodeId);
    visitedNodes.add(nodeId);
    const oriented = sampleOrientedNodeTransform(
      node,
      beat,
      parentWorld,
      adapters
    );
    const worldMatrix = parentWorld
      .clone()
      .multiply(composeSpatialTransform(oriented.transform));
    sampledNodes[nodeId] = {
      id: nodeId,
      localBeat: oriented.localBeat,
      localTransform: oriented.transform,
      worldTransform: matrix4Tuple(worldMatrix),
    };

    for (const streamId of node.streamIds) {
      if (sampledStreams[streamId]) {
        throw new Error(
          `Prop stream ${streamId} appears more than once in the tree`
        );
      }
      const stream = composition.streams[streamId];
      if (!stream) throw new Error(`Missing prop stream ${streamId}`);
      if (stream.nodeId !== nodeId) {
        throw new Error(
          `Prop stream ${streamId} declares node ${stream.nodeId}, expected ${nodeId}`
        );
      }
      const clip = composition.clips[stream.clipId];
      if (!clip) throw new Error(`Missing motion clip ${stream.clipId}`);
      const localBeat = mapCompositionBeat(
        beat,
        clip.durationBeats,
        stream.time
      );
      const localFrame = resolveClip(clip, stream, localBeat, adapters);
      const propWorld = worldMatrix
        .clone()
        .multiply(composeSpatialTransform(localFrame.transform));
      const worldPose = decomposeSpatialTransform(propWorld);
      sampledStreams[streamId] = {
        id: streamId,
        nodeId,
        localBeat,
        center: worldPose.translation,
        rotation: worldPose.rotation,
        scale: worldPose.scale,
        endpoints: localFrame.endpoints.map((endpoint) =>
          transformEndpoint(propWorld, endpoint)
        ),
        style: { ...stream.style },
      };
    }

    for (const childNodeId of node.childNodeIds) {
      visitNode(childNodeId, nodeId, worldMatrix);
    }
    activeNodes.delete(nodeId);
  };

  visitNode(composition.rootNodeId, null, new Matrix4().identity());

  if (visitedNodes.size !== Object.keys(composition.nodes).length) {
    throw new Error("Motion composition contains unreachable coordinate nodes");
  }
  if (
    Object.keys(sampledStreams).length !==
    Object.keys(composition.streams).length
  ) {
    throw new Error("Motion composition contains unattached prop streams");
  }

  let camera: SpatialCameraFrame | undefined;
  if (composition.camera) {
    const cameraBeat = mapCompositionBeat(
      beat,
      composition.camera.durationBeats,
      composition.camera.time
    );
    camera = sampleCameraKeyframes(composition.camera.keyframes, cameraBeat);
  }

  return {
    beat,
    nodes: sampledNodes,
    streams: sampledStreams,
    ...(camera ? { camera } : {}),
  };
}
