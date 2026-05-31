import { Capacitor } from "@capacitor/core";
import { isDesktop } from "../../desktop/is-desktop";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isDesktopPlatform(): boolean {
  return isDesktop();
}

export function isIOS(): boolean {
  return Capacitor.getPlatform() === "ios";
}

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === "android";
}

export function isWeb(): boolean {
  return !isDesktopPlatform() && Capacitor.getPlatform() === "web";
}

export function getPlatform(): "ios" | "android" | "web" | "desktop" {
  if (isDesktopPlatform()) return "desktop";
  return Capacitor.getPlatform() as "ios" | "android" | "web";
}
