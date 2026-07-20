import { ScanActivityWatcher } from "./implementations/ScanActivityWatcher";

let instance: ScanActivityWatcher | null = null;

export function getScanActivityWatcher(): ScanActivityWatcher {
  if (!instance) instance = new ScanActivityWatcher();
  return instance;
}
