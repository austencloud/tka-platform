import type {
  ArtSettingChangeHandler,
  ArtSettingValue,
} from "./art-settings-types";

export function reportArtSetting(
  handler: ArtSettingChangeHandler | undefined,
  group: string,
  setting: string,
  previousValue: ArtSettingValue,
  value: ArtSettingValue,
  coalesce = false,
  source?: string
): void {
  if (previousValue === value) return;
  handler?.(group, setting, previousValue, value, coalesce, source);
}

export function changeArtSetting(
  handler: ArtSettingChangeHandler | undefined,
  group: string,
  setting: string,
  previousValue: ArtSettingValue,
  value: ArtSettingValue,
  mutate: () => void,
  coalesce = false
): void {
  mutate();
  reportArtSetting(handler, group, setting, previousValue, value, coalesce);
}
