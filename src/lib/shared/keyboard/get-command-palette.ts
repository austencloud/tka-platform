import { browser } from "$app/environment";

import { CommandPalette } from "./services/command-palette";
import { getNavigationVisitPersister } from "$lib/shared/navigation/get-navigation-visit-persister";

let instance: CommandPalette | null = null;

export function getCommandPalette(): CommandPalette {
  if (!browser) throw new Error("getCommandPalette() is browser-only");
  return (instance ??= new CommandPalette(getNavigationVisitPersister()));
}
