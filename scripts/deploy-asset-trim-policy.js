/** Build-output directories whose runtime contents are deliberately tiny. */
export const DEPLOY_DIRECTORY_FILE_ALLOWLISTS = Object.freeze({
  "textures/autumn-floor": Object.freeze(["ground-detail-modulation.ktx2"]),
});

/**
 * Return every directory entry that is not part of its runtime contract.
 *
 * Vite copies `static/` verbatim. Keeping an allowlist here means a newly
 * generated bake input cannot quietly become a production asset merely
 * because it was written beside the one texture the browser actually loads.
 */
export function getDisallowedDeployEntries(entryNames, allowedNames) {
  const allowed = new Set(allowedNames);
  return entryNames.filter((entryName) => !allowed.has(entryName));
}
