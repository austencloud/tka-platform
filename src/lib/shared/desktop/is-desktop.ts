import { browser } from "$app/environment";

export function isDesktop(): boolean {
	return browser && "__TAURI_INTERNALS__" in window;
}
