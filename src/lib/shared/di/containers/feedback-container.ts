/**
 * Feedback ITI Container
 *
 * Provides services for the feedback system including sorting, editing,
 * subtask management, formatting, voice transcription, draft persistence,
 * and type resolution.
 */

import { createContainer } from "iti";
import { FeedbackSorter } from "$lib/features/feedback/services/implementations/FeedbackSorter";
import { FeedbackEditor } from "$lib/features/feedback/services/implementations/FeedbackEditor";
import { FeedbackSubtaskManager } from "$lib/features/feedback/services/implementations/FeedbackSubtaskManager";
import { FeedbackFormatter } from "$lib/features/feedback/services/implementations/FeedbackFormatter";
import { VoiceTranscriptCoordinator } from "$lib/features/feedback/services/implementations/VoiceTranscriptCoordinator";
import { FormDraftPersister } from "$lib/features/feedback/services/implementations/FormDraftPersister.svelte";
import { FeedbackTypeResolver } from "$lib/features/feedback/services/implementations/FeedbackTypeResolver";

/**
 * Creates the feedback container.
 * All feedback services have no dependencies, so they can be instantiated directly.
 */
export function createFeedbackContainer() {
  return createContainer().add({
    feedbackSorter: () => new FeedbackSorter(),
    feedbackEditor: () => new FeedbackEditor(),
    feedbackSubtaskManager: () => new FeedbackSubtaskManager(),
    feedbackFormatter: () => new FeedbackFormatter(),
    voiceTranscriptCoordinator: () => new VoiceTranscriptCoordinator(),
    formDraftPersister: () => new FormDraftPersister(),
    feedbackTypeResolver: () => new FeedbackTypeResolver(),
  });
}

export type FeedbackContainer = ReturnType<typeof createFeedbackContainer>;
