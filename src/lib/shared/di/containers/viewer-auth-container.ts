// Services that manage the guest → signed-in transition inside the sequence
// viewer: pending-action preservation across auth flows, and in-app-webview
// detection for IG/FB/TikTok browsers where Google OAuth popups are blocked.

import { createContainer } from "iti";
import { PendingActionQueue } from "$lib/shared/sequence-viewer/services/implementations/PendingActionQueue";
import { WebviewDetector } from "$lib/shared/sequence-viewer/services/implementations/WebviewDetector";

export const viewerAuthContainer = createContainer().add({
	pendingActionQueue: () => new PendingActionQueue(),
	webviewDetector: () => new WebviewDetector(),
});

export type ViewerAuthContainer = typeof viewerAuthContainer;
