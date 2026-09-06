import {
  shouldResetEffectStateAtStepBoundary,
  type EffectStepBoundary,
} from "../domain/effect-step-boundary";

export interface GhostPoseSample<TSnapshot> {
  key: string;
  snapshot: TSnapshot;
  seenAt: number;
  ageSeconds: number;
}

interface StoredGhostPose<TSnapshot> {
  snapshot: TSnapshot;
  seenAt: number;
}

export type GhostHistoryStepBoundary = EffectStepBoundary;
export const shouldResetGhostHistoryAtStepBoundary =
  shouldResetEffectStateAtStepBoundary;

/**
 * Keep the visible exposures spread across the retained time window.
 *
 * The input is oldest-first, matching `GhostPoseHistory.samples()`. Picking
 * only the newest entries makes a long Persistence setting look identical to
 * a short one whenever the prop is moving quickly. These targets preserve the
 * oldest and newest available poses and distribute the remaining draw slots
 * between them.
 */
export function selectGhostAgeStratifiedSamples<TSnapshot>(
  samples: readonly GhostPoseSample<TSnapshot>[],
  maximumSamples: number
): GhostPoseSample<TSnapshot>[] {
  const count = Math.max(0, Math.floor(maximumSamples));
  if (count === 0 || samples.length === 0) return [];
  if (samples.length <= count) return samples.slice();
  const oldestSample = samples[0];
  const newestSample = samples[samples.length - 1];
  if (!oldestSample || !newestSample) return [];
  if (count === 1) return [newestSample];

  const selected: GhostPoseSample<TSnapshot>[] = [];
  const oldestAge = oldestSample.ageSeconds;
  const newestAge = newestSample.ageSeconds;
  let firstAvailableIndex = 0;

  for (let slotIndex = 0; slotIndex < count; slotIndex += 1) {
    const targetProgress = slotIndex / (count - 1);
    const targetAge = oldestAge + (newestAge - oldestAge) * targetProgress;
    const remainingSlots = count - slotIndex;
    const lastAvailableIndex = samples.length - remainingSlots;
    const firstAvailableSample = samples[firstAvailableIndex];
    if (!firstAvailableSample) break;
    let bestIndex = firstAvailableIndex;
    let bestSample = firstAvailableSample;
    let bestDistance = Math.abs(firstAvailableSample.ageSeconds - targetAge);

    for (
      let sampleIndex = firstAvailableIndex + 1;
      sampleIndex <= lastAvailableIndex;
      sampleIndex += 1
    ) {
      const candidate = samples[sampleIndex];
      if (!candidate) continue;
      const distance = Math.abs(candidate.ageSeconds - targetAge);
      if (distance >= bestDistance) continue;
      bestIndex = sampleIndex;
      bestSample = candidate;
      bestDistance = distance;
    }

    selected.push(bestSample);
    firstAvailableIndex = bestIndex + 1;
  }

  return selected;
}

/**
 * Time-based, pose-keyed Ghost history shared by every renderer.
 *
 * Refreshing a key moves it to the newest end of the ordered map, so revisits
 * reignite one exposure and capacity pressure always evicts the oldest pose.
 */
export class GhostPoseHistory<TSnapshot> {
  private readonly poses = new Map<string, StoredGhostPose<TSnapshot>>();
  private currentEpoch: string | number | null = null;
  private hasEpoch = false;
  private elapsedSeconds = 0;

  get now(): number {
    return this.elapsedSeconds;
  }

  get size(): number {
    return this.poses.size;
  }

  setEpoch(epoch: string | number): void {
    if (this.hasEpoch && epoch === this.currentEpoch) return;
    this.reset();
    this.currentEpoch = epoch;
    this.hasEpoch = true;
  }

  advance(deltaSeconds: number): number {
    this.elapsedSeconds += Math.max(0, deltaSeconds);
    return this.elapsedSeconds;
  }

  capture(key: string, createSnapshot: () => TSnapshot): void {
    const existing = this.poses.get(key);
    if (existing) this.poses.delete(key);
    this.poses.set(key, {
      snapshot: existing?.snapshot ?? createSnapshot(),
      seenAt: this.elapsedSeconds,
    });
  }

  prune(lifetimeSeconds: number, maximumEntries: number): void {
    const lifetime = Math.max(0, lifetimeSeconds);
    for (const [key, pose] of this.poses) {
      if (this.elapsedSeconds - pose.seenAt >= lifetime) this.poses.delete(key);
    }

    const capacity = Math.max(0, Math.floor(maximumEntries));
    while (this.poses.size > capacity) {
      const oldestKey = this.poses.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.poses.delete(oldestKey);
    }
  }

  samples(
    excludedKeys: ReadonlySet<string> = new Set()
  ): GhostPoseSample<TSnapshot>[] {
    const result: GhostPoseSample<TSnapshot>[] = [];
    for (const [key, pose] of this.poses) {
      if (excludedKeys.has(key)) continue;
      result.push({
        key,
        snapshot: pose.snapshot,
        seenAt: pose.seenAt,
        ageSeconds: this.elapsedSeconds - pose.seenAt,
      });
    }
    return result;
  }

  reset(): void {
    this.poses.clear();
    this.currentEpoch = null;
    this.hasEpoch = false;
    this.elapsedSeconds = 0;
  }
}
