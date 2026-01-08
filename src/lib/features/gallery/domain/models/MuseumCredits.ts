/**
 * Museum Credits
 *
 * Attribution data for 3D assets used in the gallery.
 * Required by Creative Commons licenses.
 */

export interface AssetCredit {
  /** Name of the 3D model/asset */
  readonly assetName: string;
  /** Creator's name or username */
  readonly creatorName: string;
  /** URL to creator's profile (optional) */
  readonly creatorUrl?: string;
  /** URL to the original asset */
  readonly assetUrl: string;
  /** License type (e.g., "CC BY 4.0", "CC0 1.0") */
  readonly license: string;
  /** URL to the license */
  readonly licenseUrl: string;
  /** Was the asset modified? */
  readonly modified?: boolean;
  /** Description of modifications (if any) */
  readonly modifications?: string;
}

/**
 * Credits for the museum environment.
 */
export const MUSEUM_CREDITS: AssetCredit[] = [
  {
    assetName: "Art Gallery",
    creatorName: "denis_cliofas",
    creatorUrl: "https://sketchfab.com/denis_cliofas",
    assetUrl: "https://sketchfab.com/3d-models/art-gallery-7995e60761c24ae0a637c6b8fd2eea29",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    modified: true,
    modifications: "Replaced painting textures with TKA sequence thumbnails",
  },
];

/**
 * Format a credit for display.
 */
export function formatCredit(credit: AssetCredit): string {
  let text = `"${credit.assetName}" by ${credit.creatorName}`;
  text += ` is licensed under ${credit.license}`;

  if (credit.modified && credit.modifications) {
    text += `. Modified: ${credit.modifications}`;
  }

  return text;
}

/**
 * Format credits as HTML for display in UI.
 */
export function formatCreditsHtml(credits: readonly AssetCredit[]): string {
  if (credits.length === 0) {
    return "<p>No third-party assets used.</p>";
  }

  return credits
    .map((c) => {
      const creatorLink = c.creatorUrl
        ? `<a href="${c.creatorUrl}" target="_blank" rel="noopener">${c.creatorName}</a>`
        : c.creatorName;

      const assetLink = `<a href="${c.assetUrl}" target="_blank" rel="noopener">"${c.assetName}"</a>`;
      const licenseLink = `<a href="${c.licenseUrl}" target="_blank" rel="noopener">${c.license}</a>`;

      let html = `${assetLink} by ${creatorLink} is licensed under ${licenseLink}`;

      if (c.modified && c.modifications) {
        html += `<br><em>Modified: ${c.modifications}</em>`;
      }

      return `<p>${html}</p>`;
    })
    .join("\n");
}
