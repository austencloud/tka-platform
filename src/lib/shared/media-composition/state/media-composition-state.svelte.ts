import type { MediaSourceKind } from "$lib/shared/media-composition/domain/media-source-schema";
import type { MediaCompositionPreset } from "$lib/shared/media-composition/domain/media-composition-preset-schema";
import type {
  ClipTransform,
  LayoutRegion,
} from "$lib/shared/media-composition/domain/media-layout-schema";
import {
  evaluatePresetFrame,
  resolvePresetTimePoint,
} from "$lib/shared/media-composition/services/frame-evaluator";
import type { SequenceTimeMap } from "$lib/shared/media-composition/domain/sequence-time-map";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { MediaCompositionPresetSchema } from "$lib/shared/media-composition/domain/media-composition-preset-schema";

type VisualPresetClip = Extract<
  MediaCompositionPreset["clips"][number],
  { kind: "visual" }
>;

export type CompositionSourceStatus = "ready" | "preparing" | "missing";

export interface CompositionSourceBinding {
  roleKey: string;
  kind: MediaSourceKind;
  label: string;
  previewUrl: string | null;
  previewType?: "video" | "image";
  renderMode?: "external-media" | "sequence-animation" | "choreo-card";
  durationSeconds?: number;
  status: CompositionSourceStatus;
  missingMessage?: string;
}

export interface MediaCompositionStateDeps {
  presets: readonly MediaCompositionPreset[];
  initialPresetId?: string;
  getBindings: () => readonly CompositionSourceBinding[];
  getSequenceTimeMap?: (durationSeconds: number) => SequenceTimeMap | null;
  getSequenceSteps?: () => readonly StepData[];
  startPositionDuration?: number;
  requestSource?: (roleKey: string) => void;
}

function clonePreset(preset: MediaCompositionPreset): MediaCompositionPreset {
  // Presets are schema-constrained JSON. Serializing here deliberately strips
  // Svelte's nested reactive proxies before the snapshot crosses into Dexie or
  // Firestore, both of which require structured-cloneable plain data.
  return JSON.parse(JSON.stringify(preset)) as MediaCompositionPreset;
}

export function createMediaCompositionState(deps: MediaCompositionStateDeps) {
  if (deps.presets.length === 0) {
    throw new Error("Media composition state needs at least one preset");
  }

  const firstPreset = deps.presets[0]!;
  const seededPreset =
    deps.presets.find((preset) => preset.id === deps.initialPresetId) ??
    firstPreset;
  let workingPresets = $state<Record<string, MediaCompositionPreset>>(
    Object.fromEntries(
      deps.presets.map((preset) => [preset.id, clonePreset(preset)])
    )
  );
  let activePresetId = $state(seededPreset.id);
  let selectedRegionId = $state<string | null>(
    seededPreset.regions[0]?.id ?? null
  );
  let safeZonesVisible = $state(true);
  let previewSeconds = $state(0);
  let isPlaying = $state(false);
  let durationOverrides = $state<Record<string, number>>({});

  function getActivePreset(): MediaCompositionPreset {
    return workingPresets[activePresetId] ?? workingPresets[firstPreset.id]!;
  }

  function getRegions(): LayoutRegion[] {
    return getActivePreset().regions;
  }

  function getSelectedRegion(): LayoutRegion | null {
    const regions = getRegions();
    return (
      regions.find((region) => region.id === selectedRegionId) ??
      regions[0] ??
      null
    );
  }

  function getBindings(): readonly CompositionSourceBinding[] {
    return deps.getBindings();
  }

  function getMissingRequiredRoles(): CompositionSourceBinding[] {
    const bindings = getBindings();
    const requiredRoleKeys = getActivePreset()
      .sourceRoles.filter((role) => role.required)
      .map((role) => role.key);
    return requiredRoleKeys.flatMap((roleKey) => {
      const binding = bindings.find(
        (candidate) => candidate.roleKey === roleKey
      );
      return binding?.status !== "ready"
        ? [
            binding ?? {
              roleKey,
              kind: "image" as const,
              label: roleKey,
              previewUrl: null,
              status: "missing" as const,
            },
          ]
        : [];
    });
  }

  function getDurationSeconds(): number {
    const activePreset = getActivePreset();
    if (activePreset.duration.mode === "fixed") {
      return activePreset.duration.seconds;
    }
    const roleKey = activePreset.duration.sourceRole;
    const binding = getBindings().find(
      (candidate) => candidate.roleKey === roleKey
    );
    return durationOverrides[roleKey] ?? binding?.durationSeconds ?? 8;
  }

  function getFrameLayers() {
    const durationSeconds = getDurationSeconds();
    const timeMap = deps.getSequenceTimeMap?.(durationSeconds) ?? null;
    const steps = deps.getSequenceSteps?.() ?? [];
    return evaluatePresetFrame(
      getActivePreset(),
      durationSeconds,
      previewSeconds,
      timeMap
        ? {
            timeMap,
            steps,
            startPositionDuration: deps.startPositionDuration ?? 1,
          }
        : null
    );
  }

  function selectPreset(id: string): void {
    const next = workingPresets[id];
    if (!next) return;
    activePresetId = id;
    selectedRegionId = next.regions[0]?.id ?? null;
    previewSeconds = 0;
    isPlaying = false;
  }

  function addPreset(
    input: MediaCompositionPreset,
    select = false
  ): MediaCompositionPreset {
    const preset = MediaCompositionPresetSchema.parse(input);
    workingPresets = { ...workingPresets, [preset.id]: clonePreset(preset) };
    if (select) selectPreset(preset.id);
    return preset;
  }

  function createPreset(name: string, ownerId: string): MediaCompositionPreset {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Preset name is required");
    const now = Date.now();
    return MediaCompositionPresetSchema.parse({
      ...clonePreset(getActivePreset()),
      id: crypto.randomUUID(),
      ownerId,
      name: trimmedName,
      description: `Saved from ${getActivePreset().name}.`,
      createdAt: now,
      updatedAt: now,
    });
  }

  function selectRegion(id: string): void {
    if (!getRegions().some((region) => region.id === id)) return;
    selectedRegionId = id;
  }

  function selectRole(roleKey: string): void {
    const activePreset = getActivePreset();
    const currentClip = activePreset.clips.find(
      (clip) => clip.kind === "visual" && clip.sourceRole === roleKey
    );
    if (currentClip?.kind === "visual") {
      selectedRegionId = currentClip.regionId;
      return;
    }

    const matchingPreset = Object.values(workingPresets).find((preset) =>
      preset.clips.some(
        (clip) => clip.kind === "visual" && clip.sourceRole === roleKey
      )
    );
    if (!matchingPreset) return;
    activePresetId = matchingPreset.id;
    const matchingClip = matchingPreset.clips.find(
      (clip) => clip.kind === "visual" && clip.sourceRole === roleKey
    );
    selectedRegionId =
      matchingClip?.kind === "visual" ? matchingClip.regionId : null;
  }

  function setSelectedFit(fit: LayoutRegion["fit"]): void {
    const selectedRegion = getSelectedRegion();
    if (!selectedRegion) return;
    const preset = workingPresets[activePresetId];
    if (!preset) return;
    workingPresets = {
      ...workingPresets,
      [activePresetId]: {
        ...preset,
        regions: preset.regions.map((region) =>
          region.id === selectedRegion.id ? { ...region, fit } : region
        ),
        updatedAt: Date.now(),
      },
    };
  }

  function getSelectedVisualClips(): VisualPresetClip[] {
    const selectedRegion = getSelectedRegion();
    if (!selectedRegion) return [];
    return getActivePreset().clips.filter(
      (clip): clip is VisualPresetClip =>
        clip.kind === "visual" && clip.regionId === selectedRegion.id
    );
  }

  function updateSelectedVisualClips(
    update: (clip: VisualPresetClip) => VisualPresetClip
  ): void {
    const selectedRegion = getSelectedRegion();
    const preset = workingPresets[activePresetId];
    if (!selectedRegion || !preset) return;

    workingPresets = {
      ...workingPresets,
      [activePresetId]: {
        ...preset,
        clips: preset.clips.map((clip) =>
          clip.kind === "visual" && clip.regionId === selectedRegion.id
            ? update(clip)
            : clip
        ),
        updatedAt: Date.now(),
      },
    };
  }

  function setSelectedTransform(patch: Partial<ClipTransform>): void {
    const validPatch: Partial<ClipTransform> = {};
    if (patch.scale !== undefined && Number.isFinite(patch.scale)) {
      validPatch.scale = Math.min(4, Math.max(0.25, patch.scale));
    }
    if (
      patch.rotationDegrees !== undefined &&
      Number.isFinite(patch.rotationDegrees)
    ) {
      validPatch.rotationDegrees = Math.min(
        360,
        Math.max(-360, patch.rotationDegrees)
      );
    }
    if (patch.translateX !== undefined && Number.isFinite(patch.translateX)) {
      validPatch.translateX = Math.min(1, Math.max(-1, patch.translateX));
    }
    if (patch.translateY !== undefined && Number.isFinite(patch.translateY)) {
      validPatch.translateY = Math.min(1, Math.max(-1, patch.translateY));
    }
    if (Object.keys(validPatch).length === 0) return;

    updateSelectedVisualClips((clip) => ({
      ...clip,
      transform: { ...clip.transform, ...validPatch },
    }));
  }

  function setSelectedOpacity(opacity: number): void {
    if (!Number.isFinite(opacity)) return;
    const clampedOpacity = Math.min(1, Math.max(0, opacity));
    updateSelectedVisualClips((clip) => ({ ...clip, opacity: clampedOpacity }));
  }

  function resetSelectedAppearance(): void {
    updateSelectedVisualClips((clip) => ({
      ...clip,
      opacity: 1,
      transform: {
        scale: 1,
        rotationDegrees: 0,
        translateX: 0,
        translateY: 0,
      },
    }));
  }

  function setClipBoundary(
    clipId: string,
    boundary: "start" | "end",
    seconds: number
  ): void {
    if (!Number.isFinite(seconds)) return;
    const preset = getActivePreset();
    const clip = preset.clips.find(
      (candidate) => candidate.kind === "visual" && candidate.id === clipId
    );
    if (!clip || clip.kind !== "visual") return;

    const duration = getDurationSeconds();
    const minimumClipSeconds = Math.min(0.25, duration / 4);
    const minimumTransitionSeconds = Math.min(0.2, duration / 5);
    const currentStart = resolvePresetTimePoint(clip.start, duration);
    const currentEnd = resolvePresetTimePoint(clip.end, duration);

    let nextStart = currentStart;
    let nextEnd = currentEnd;
    if (boundary === "start") {
      nextStart = Math.min(
        currentEnd - minimumClipSeconds,
        Math.max(0, seconds)
      );
    } else {
      nextEnd = Math.max(
        currentStart + minimumClipSeconds,
        Math.min(duration, seconds)
      );
    }

    for (const transition of preset.transitions) {
      if (transition.outgoingClipId === clipId && boundary === "end") {
        const incoming = preset.clips.find(
          (candidate) => candidate.id === transition.incomingClipId
        );
        if (incoming) {
          nextEnd = Math.max(
            nextEnd,
            resolvePresetTimePoint(incoming.start, duration) +
              minimumTransitionSeconds
          );
        }
      }
      if (transition.incomingClipId === clipId && boundary === "start") {
        const outgoing = preset.clips.find(
          (candidate) => candidate.id === transition.outgoingClipId
        );
        if (outgoing) {
          nextStart = Math.min(
            nextStart,
            resolvePresetTimePoint(outgoing.end, duration) -
              minimumTransitionSeconds
          );
        }
      }
    }

    nextStart = Math.max(0, nextStart);
    nextEnd = Math.min(duration, nextEnd);
    const start = {
      unit: "duration-fraction" as const,
      value: nextStart / duration,
    };
    const end = {
      unit: "duration-fraction" as const,
      value: nextEnd / duration,
    };
    const clips = preset.clips.map((candidate) =>
      candidate.id === clipId
        ? { ...candidate, start, end, sourceIn: start, sourceOut: end }
        : candidate
    );
    const transitions = preset.transitions.map((transition) => {
      const outgoing = clips.find(
        (candidate) => candidate.id === transition.outgoingClipId
      );
      const incoming = clips.find(
        (candidate) => candidate.id === transition.incomingClipId
      );
      if (!outgoing || !incoming) return transition;
      return {
        ...transition,
        start: {
          unit: "duration-fraction" as const,
          value:
            Math.max(
              resolvePresetTimePoint(outgoing.start, duration),
              resolvePresetTimePoint(incoming.start, duration)
            ) / duration,
        },
        end: {
          unit: "duration-fraction" as const,
          value:
            Math.min(
              resolvePresetTimePoint(outgoing.end, duration),
              resolvePresetTimePoint(incoming.end, duration)
            ) / duration,
        },
      };
    });

    workingPresets = {
      ...workingPresets,
      [activePresetId]: {
        ...preset,
        clips,
        transitions,
        updatedAt: Date.now(),
      },
    };
  }

  function toggleSafeZones(): void {
    safeZonesVisible = !safeZonesVisible;
  }

  function setSourceDuration(roleKey: string, seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    durationOverrides = { ...durationOverrides, [roleKey]: seconds };
  }

  function seek(seconds: number): void {
    previewSeconds = Math.min(getDurationSeconds(), Math.max(0, seconds));
  }

  function togglePlayback(): void {
    if (previewSeconds >= getDurationSeconds()) previewSeconds = 0;
    isPlaying = !isPlaying;
  }

  function pause(): void {
    isPlaying = false;
  }

  function advance(deltaSeconds: number): void {
    if (!isPlaying || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0)
      return;
    const next = previewSeconds + deltaSeconds;
    if (next >= getDurationSeconds()) {
      previewSeconds = 0;
      return;
    }
    previewSeconds = next;
  }

  function roleForRegion(regionId: string): string | null {
    const activePreset = getActivePreset();
    const clip = activePreset.clips.find(
      (candidate) =>
        candidate.kind === "visual" && candidate.regionId === regionId
    );
    return clip?.sourceRole ?? null;
  }

  function bindingForRole(roleKey: string): CompositionSourceBinding | null {
    return getBindings().find((binding) => binding.roleKey === roleKey) ?? null;
  }

  function requestSource(roleKey: string): void {
    deps.requestSource?.(roleKey);
  }

  return {
    get presets() {
      return Object.values(workingPresets);
    },
    get activePresetId() {
      return activePresetId;
    },
    get activePreset() {
      return getActivePreset();
    },
    get regions() {
      return getRegions();
    },
    get selectedRegion() {
      return getSelectedRegion();
    },
    get selectedTransform() {
      return getSelectedVisualClips()[0]?.transform ?? null;
    },
    get selectedOpacity() {
      return getSelectedVisualClips()[0]?.opacity ?? null;
    },
    get bindings() {
      return getBindings();
    },
    get missingRequiredRoles() {
      return getMissingRequiredRoles();
    },
    get isReady() {
      return getMissingRequiredRoles().length === 0;
    },
    get safeZonesVisible() {
      return safeZonesVisible;
    },
    get durationSeconds() {
      return getDurationSeconds();
    },
    get previewSeconds() {
      return previewSeconds;
    },
    get isPlaying() {
      return isPlaying;
    },
    get frameLayers() {
      return getFrameLayers();
    },
    get sequenceTimeMap() {
      return deps.getSequenceTimeMap?.(getDurationSeconds()) ?? null;
    },
    selectPreset,
    addPreset,
    createPreset,
    selectRegion,
    selectRole,
    setSelectedFit,
    setSelectedTransform,
    setSelectedOpacity,
    resetSelectedAppearance,
    setClipBoundary,
    toggleSafeZones,
    setSourceDuration,
    seek,
    togglePlayback,
    pause,
    advance,
    roleForRegion,
    bindingForRole,
    requestSource,
  };
}

export type MediaCompositionState = ReturnType<
  typeof createMediaCompositionState
>;
