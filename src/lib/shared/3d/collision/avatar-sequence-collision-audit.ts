import type {
  AvatarPoseDiagnostics,
  CollisionEvent,
} from "@austencloud/scene-3d";

type CollisionSeverity = CollisionEvent["severity"];
type CollisionZone = CollisionEvent["zone"];

const SEVERITY_RANK: Record<CollisionSeverity, number> = {
  graze: 0,
  clip: 1,
  penetrate: 2,
};

export const AVATAR_COLLISION_AUDIT_STORAGE_KEY =
  "__avatarCollisionAuditReport";
export const AVATAR_COLLISION_AUDIT_ATTRIBUTE =
  "data-avatar-collision-audit-report";

export interface CollisionCluster {
  performerId: string;
  zone: CollisionZone;
  severity: CollisionSeverity;
  frameCount: number;
  firstStep: number;
  firstProgress: number;
  lastStep: number;
  lastProgress: number;
  worstStep: number;
  worstProgress: number;
  worstPenetrationDepth: number;
  worstPose: AvatarPoseDiagnostics;
  descriptions: string[];
}

export interface CollisionAuditReport {
  sampledFrames: number;
  currentPoseByPerformer: Record<string, AvatarPoseDiagnostics>;
  clusters: CollisionCluster[];
}

interface MutableCluster extends CollisionCluster {
  descriptionSet: Set<string>;
}

function clusterKey(performerId: string, zone: CollisionZone): string {
  return `${performerId}:${zone}`;
}

function copyCluster(cluster: MutableCluster): CollisionCluster {
  const { descriptionSet: _descriptionSet, ...copy } = cluster;
  return { ...copy, descriptions: [...copy.descriptions] };
}

/** Groups per-render-frame collision events into reviewable motion spans. */
export class AvatarSequenceCollisionAudit {
  private readonly open = new Map<string, MutableCluster>();
  private readonly completed: CollisionCluster[] = [];
  private readonly currentPoseByPerformer = new Map<
    string,
    AvatarPoseDiagnostics
  >();
  private sampledFrames = 0;

  record(
    performerId: string,
    events: readonly CollisionEvent[],
    diagnostics: AvatarPoseDiagnostics = {
      requestedStanceYawRad: 0,
      achievedShoulderYawRad: 0,
      shoulderWidth: 0,
    }
  ): void {
    this.sampledFrames += 1;
    this.currentPoseByPerformer.set(performerId, { ...diagnostics });
    const worstByZone = new Map<CollisionZone, CollisionEvent>();

    for (const event of events) {
      const current = worstByZone.get(event.zone);
      if (!current || event.penetrationDepth > current.penetrationDepth) {
        worstByZone.set(event.zone, event);
      }
    }

    for (const [key, cluster] of this.open) {
      if (cluster.performerId !== performerId) continue;
      if (!worstByZone.has(cluster.zone)) {
        this.completed.push(copyCluster(cluster));
        this.open.delete(key);
      }
    }

    for (const [zone, event] of worstByZone) {
      const key = clusterKey(performerId, zone);
      const cluster = this.open.get(key);
      if (!cluster) {
        this.open.set(key, {
          performerId,
          zone,
          severity: event.severity,
          frameCount: 1,
          firstStep: event.stepNumber,
          firstProgress: event.beatProgress,
          lastStep: event.stepNumber,
          lastProgress: event.beatProgress,
          worstStep: event.stepNumber,
          worstProgress: event.beatProgress,
          worstPenetrationDepth: event.penetrationDepth,
          worstPose: { ...diagnostics },
          descriptions: [event.description],
          descriptionSet: new Set([event.description]),
        });
        continue;
      }

      cluster.frameCount += 1;
      cluster.lastStep = event.stepNumber;
      cluster.lastProgress = event.beatProgress;
      if (SEVERITY_RANK[event.severity] > SEVERITY_RANK[cluster.severity]) {
        cluster.severity = event.severity;
      }
      if (event.penetrationDepth > cluster.worstPenetrationDepth) {
        cluster.worstPenetrationDepth = event.penetrationDepth;
        cluster.worstStep = event.stepNumber;
        cluster.worstProgress = event.beatProgress;
        cluster.worstPose = { ...diagnostics };
      }
      if (!cluster.descriptionSet.has(event.description)) {
        cluster.descriptionSet.add(event.description);
        cluster.descriptions.push(event.description);
      }
    }

    if (this.sampledFrames % 15 === 0) this.publishBrowserSnapshot();
  }

  report(): CollisionAuditReport {
    return {
      sampledFrames: this.sampledFrames,
      currentPoseByPerformer: Object.fromEntries(
        [...this.currentPoseByPerformer].map(([performerId, diagnostics]) => [
          performerId,
          { ...diagnostics },
        ])
      ),
      clusters: [
        ...this.completed.map((cluster) => ({
          ...cluster,
          descriptions: [...cluster.descriptions],
        })),
        ...[...this.open.values()].map(copyCluster),
      ].sort((a, b) => b.worstPenetrationDepth - a.worstPenetrationDepth),
    };
  }

  clear(): void {
    this.open.clear();
    this.completed.length = 0;
    this.currentPoseByPerformer.clear();
    this.sampledFrames = 0;
    this.publishBrowserSnapshot();
  }

  private publishBrowserSnapshot(): void {
    const serializedReport = JSON.stringify(this.report());
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(
        AVATAR_COLLISION_AUDIT_STORAGE_KEY,
        serializedReport
      );
    }
    if (typeof document !== "undefined" && import.meta.env.DEV) {
      document.documentElement.setAttribute(
        AVATAR_COLLISION_AUDIT_ATTRIBUTE,
        serializedReport
      );
    }
  }
}

let audit: AvatarSequenceCollisionAudit | undefined;

export function getAvatarSequenceCollisionAudit(): AvatarSequenceCollisionAudit {
  audit ??= new AvatarSequenceCollisionAudit();
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    (
      window as typeof window & {
        __avatarCollisionAudit?: AvatarSequenceCollisionAudit;
      }
    ).__avatarCollisionAudit = audit;
  }
  return audit;
}
