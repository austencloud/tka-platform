import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { ResolvedAutoLayout } from "$lib/shared/render/services/container-aware-layout";
import type { ShareURLMetadata } from "$lib/shared/navigation/services/types";
import type { PendingActionType } from "./pending-action-queue";
import type { ViewerMode } from "../state/viewer-state.svelte";
import type { ExportType } from "../domain/viewer-orchestrator-context";

export type ViewerEditingPane = "animation" | "image" | "video-upload" | null;

export function resolveSceneBpmIntent(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function resolveEditingPane(
  viewerMode: ViewerMode,
  exportContext: "animation-export" | "image-export" | null,
  videoUploadOpen: boolean
): ViewerEditingPane {
  if (exportContext === "animation-export") return "animation";
  if (exportContext === "image-export") return "image";
  if (viewerMode === "videos" && videoUploadOpen) return "video-upload";
  return null;
}

export function resolveExportType(
  editingPane: ViewerEditingPane
): ExportType | null {
  if (editingPane === "animation") return "animation";
  if (editingPane === "image") return "image";
  return null;
}

export function calculateSinglePlayDuration(
  sequence: SequenceData | null,
  bpm: number
): number {
  const steps = sequence?.steps;
  if (!steps?.length || bpm <= 0) return 0;
  const durationUnits = steps.reduce(
    (sum, step) => sum + (step.duration ?? 1),
    0
  );
  return durationUnits / (bpm / 60);
}

export function hasSameResolvedCardLayout(
  current: ResolvedAutoLayout | null,
  next: ResolvedAutoLayout | null
): boolean {
  return (
    current?.stepCount === next?.stepCount &&
    current?.cols === next?.cols &&
    current?.rows === next?.rows &&
    current?.startPlacement === next?.startPlacement
  );
}

export interface ViewerShareDetails {
  url: string;
  title: string;
  text: string;
  activityMetadata: {
    sequenceId: string | undefined;
    sequenceWord: string | undefined;
    sequenceLength: number | undefined;
  };
}

interface ViewerShareDetailsInput {
  sequence: SequenceData | null;
  bpm: number;
  darkMode: boolean;
  fallbackUrl: string;
  buildUrl: (sequence: SequenceData, metadata: ShareURLMetadata) => string;
}

export function buildViewerShareDetails(
  input: ViewerShareDetailsInput
): ViewerShareDetails {
  const { sequence } = input;
  let url = input.fallbackUrl;

  if (sequence) {
    try {
      const metadata: ShareURLMetadata = {};
      if (sequence.word) metadata.word = sequence.word;
      if (sequence.ownerDisplayName)
        metadata.creator = sequence.ownerDisplayName;
      if (typeof sequence.metadata?.notes === "string") {
        metadata.notes = sequence.metadata.notes;
      }
      if (typeof sequence.metadata?.difficulty === "string") {
        metadata.difficulty = sequence.metadata.difficulty;
      }
      const birthdaySource = sequence.birthday ?? sequence.createdAt;
      if (birthdaySource) {
        const birthday =
          birthdaySource instanceof Date
            ? birthdaySource
            : new Date(birthdaySource);
        if (!Number.isNaN(birthday.getTime())) {
          metadata.birthday = birthday
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");
        }
      }
      metadata.bpm = input.bpm;
      metadata.darkMode = input.darkMode;
      url = input.buildUrl(sequence, metadata);
    } catch {
      // A malformed optional metadata field must not make sharing unavailable.
    }
  }

  const title =
    sequence?.displayName ||
    sequence?.intendedWord ||
    sequence?.word ||
    sequence?.name ||
    "Sequence";

  return {
    url,
    title,
    text: `TKA sequence: ${title}`,
    activityMetadata: {
      sequenceId: sequence?.id,
      sequenceWord: sequence?.word,
      sequenceLength: sequence?.steps.length,
    },
  };
}

export function buildViewerWebUrl(
  baseUrl: string,
  pendingType: PendingActionType | null = null
): string | null {
  if (!baseUrl) return null;
  const parsed = new URL(baseUrl);
  if (pendingType) parsed.searchParams.set("pending", pendingType);
  return parsed.toString();
}

export function buildViewerBrowserUrl(
  baseUrl: string,
  pendingType: PendingActionType | null = null
): string | null {
  const webUrl = buildViewerWebUrl(baseUrl, pendingType);
  if (!webUrl) return null;
  return `intent://${webUrl.replace(/^https?:\/\//, "")}#Intent;scheme=https;end`;
}

export function resolveCurrentStepData(
  sequence: SequenceData | null,
  currentStep: number,
  showPreviousBeat: boolean
): StartPositionData | StepData | null {
  if (!sequence) return null;
  if (showPreviousBeat) {
    const previousIndex = Math.round(currentStep) - 2;
    if (previousIndex < 0 && sequence.startPosition) {
      return sequence.startPosition;
    }
    if (sequence.steps?.length > 0) {
      return (
        sequence.steps[
          Math.min(Math.max(0, previousIndex), sequence.steps.length - 1)
        ] ?? null
      );
    }
  }
  if (currentStep < 1 && sequence.startPosition) {
    return sequence.startPosition;
  }
  if (sequence.steps?.length > 0) {
    const index = Math.max(0, Math.floor(currentStep) - 1);
    return sequence.steps[Math.min(index, sequence.steps.length - 1)] ?? null;
  }
  return null;
}
