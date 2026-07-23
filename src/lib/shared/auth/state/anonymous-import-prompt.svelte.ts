import type { AnonymousDraft } from "$lib/shared/auth/services/anonymous-upgrade";
import { importDrafts } from "$lib/shared/auth/services/anonymous-upgrade";
import { showToast } from "$lib/shared/toast/state/toast-state.svelte";

interface ImportPromptState {
  isOpen: boolean;
  drafts: AnonymousDraft[];
}

const state = $state<ImportPromptState>({ isOpen: false, drafts: [] });

export const anonymousImportPrompt = {
  get isOpen() {
    return state.isOpen;
  },
  set isOpen(v: boolean) {
    state.isOpen = v;
  },
  get count() {
    return state.drafts.length;
  },
};

/** Open the import offer if there is anything worth importing. */
export function promptAnonymousImport(drafts: AnonymousDraft[]): void {
  if (!drafts.length) return;
  state.drafts = drafts;
  state.isOpen = true;
}

export async function confirmAnonymousImport(): Promise<void> {
  const drafts = state.drafts;
  state.isOpen = false;
  state.drafts = [];
  const n = await importDrafts(drafts);
  if (n > 0) showToast(`Imported ${n} sequence${n === 1 ? "" : "s"} you just made.`, "success");
}

export function cancelAnonymousImport(): void {
  state.isOpen = false;
  state.drafts = [];
}
