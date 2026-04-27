import { browser } from "$app/environment";
import { DesktopInitializer } from "./DesktopInitializer";

let instance: DesktopInitializer | null = null;

export function getDesktopInitializer(): DesktopInitializer {
	if (!browser) throw new Error("getDesktopInitializer() is browser-only");
	return (instance ??= new DesktopInitializer());
}
