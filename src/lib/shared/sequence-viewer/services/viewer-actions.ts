import type { OrchestratorContext } from "../components/SequenceViewerOrchestrator.svelte";

export type ViewerHeaderProfile = "full" | "scan";

/**
 * Handlers the orchestrator `ctx` cannot own — page-local wiring. `full` passes
 * `onDeleteRequest` (opens the page's confirm dialog); `scan` passes the funnel
 * handlers (its own export + composer handoff + explore-home href).
 */
export interface ViewerActionWiring {
  onDeleteRequest?: () => void;
  onDownload?: () => void;
  downloadBusy?: boolean;
  onOpenInComposer?: () => void;
  openAppHref?: string;
}

/**
 * The exact gated prop-set both header surfaces feed to `ViewerOverflowMenu`
 * (and their desktop right-cluster). `undefined` handler = the action is hidden.
 */
export interface ViewerHeaderActions {
  isFavorite: boolean;
  isSaved: boolean;
  isPublished: boolean;
  practiceActive: boolean;
  showPractice: boolean;
  onFavoriteToggle?: () => void;
  onSave?: () => void;
  onRemix?: () => void;
  remixLabel?: string;
  onDownload?: () => void;
  downloadBusy?: boolean;
  onOpenApp?: () => void;
  onVideoUpload?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onDeleteRequest?: () => void;
  onCopyData?: () => void;
  onPracticeToggle?: () => void;
}

/**
 * Single source of truth for which viewer actions exist and when. Gate rules
 * (grounded in SequenceViewerOrchestrator.svelte:400,1060):
 *   - Funnel (scan only): Open-in-Composer (as Remix), Download, Open TKA.
 *   - Engagement (favorite/save/remix/practice): always on `full` (a guest tap
 *     prompts login via invokeGatedAction). On `scan` these appear only once the
 *     scanner is a signed-in user — a cold guest sees only funnel actions.
 *   - Management (video/publish/unpublish/delete): gated by ctx eligibility
 *     (isLoggedIn / isOwned && isSaved), profile-independent.
 */
export function buildHeaderActions(
  ctx: OrchestratorContext,
  profile: ViewerHeaderProfile,
  wiring: ViewerActionWiring = {},
): ViewerHeaderActions {
  const ownerCanManage = ctx.isOwned && ctx.isSaved;
  const showEngagement = profile === "full" || ctx.isLoggedIn;

  const a: ViewerHeaderActions = {
    isFavorite: ctx.isFavorite,
    isSaved: ctx.isSaved,
    isPublished: ctx.isPublished,
    practiceActive: ctx.practiceActive,
    showPractice: showEngagement,
  };

  if (profile === "scan") {
    a.onRemix = wiring.onOpenInComposer;
    a.remixLabel = "Open in Composer";
    a.onDownload = wiring.onDownload;
    a.downloadBusy = wiring.downloadBusy;
    a.onOpenApp = wiring.openAppHref
      ? () => {
          location.href = wiring.openAppHref!;
        }
      : undefined;
  }

  if (showEngagement) {
    a.onFavoriteToggle = () =>
      ctx.invokeGatedAction("favorite", ctx.handleFavoriteToggle);
    a.onSave = () => ctx.invokeGatedAction("save", ctx.handleSave);
    if (profile === "full") {
      a.onRemix = () => ctx.invokeGatedAction("remix", ctx.handleEdit);
    }
    a.onPracticeToggle = () =>
      ctx.practiceActive ? ctx.exitPracticeMode() : ctx.enterPracticeMode();
  }

  if (ctx.isLoggedIn) a.onVideoUpload = () => ctx.handleVideoUpload();
  if (ownerCanManage) {
    a.onPublish = () =>
      ctx.invokeGatedAction("publish", ctx.handlePublishAction);
    a.onUnpublish = ctx.handleUnpublishAction;
    a.onDeleteRequest = wiring.onDeleteRequest;
  }

  return a;
}
