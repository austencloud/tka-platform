/**
 * Shared signal for the Profile Screen drawer.
 *
 * Same pattern as myPropsDrawerState — the drawer renders at the document
 * root (MainInterface.svelte) to avoid backdrop-filter containment from
 * the sidebar. Multiple sources (ModuleSwitcher, AccountPopover) can
 * trigger open via this shared state.
 */

let isOpen = $state(false);

export const profileScreenState = {
	get isOpen() {
		return isOpen;
	},
	set isOpen(v: boolean) {
		isOpen = v;
	},

	open() {
		isOpen = true;
	},
	close() {
		isOpen = false;
	},
};
