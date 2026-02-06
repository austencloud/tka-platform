/**
 * Session Management Exports
 *
 * Exports all session-related services, models, and components.
 *
 * Domain: Create module - Session management
 */

// Domain Models
export {
  type SequenceSession,
  createSequenceSession,
  generateDeviceId,
} from "./domain/SequenceSession";
export {
  type DraftSequence,
  createDraftSequence,
} from "./domain/DraftSequence";

// Services
export { SessionManager } from "./services/SessionManager.svelte";
export { Autosaver } from "./services/Autosaver";
export {
  SequencePersister,
  type SaveSequenceMetadata,
  type SavedSequence,
} from "./services/SequencePersister";

// UI Components
export { default as SavePromptDialog } from "./components/dialogs/SavePromptDialog.svelte";
export { default as RecentSequencesPanel } from "./components/panels/RecentSequencesPanel.svelte";
export { default as NewSequenceButton } from "./workspace-panel/shared/components/buttons/NewSequenceButton.svelte";
