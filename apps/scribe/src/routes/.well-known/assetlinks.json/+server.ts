import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Digital Asset Links for Android TWA (Trusted Web Activity)
 *
 * This file proves domain ownership to Android, allowing the TWA app
 * to open in fullscreen mode without the browser URL bar.
 *
 * IMPORTANT: Update the sha256_cert_fingerprints after generating
 * your signing key with bubblewrap. Get it by running:
 *   keytool -list -v -keystore <your-keystore.jks>
 */

const SHA256_FINGERPRINT =
  "74:B7:8B:7B:F0:C7:9D:1B:F3:FB:A4:0E:14:F4:25:5B:86:CE:EC:6F:6E:BA:04:9B:18:11:23:67:59:83:F6:B5";

export const GET: RequestHandler = async () => {
  const assetLinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.tkascribe.app",
        sha256_cert_fingerprints: [SHA256_FINGERPRINT],
      },
    },
  ];

  return json(assetLinks, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400", // Cache for 24 hours
    },
  });
};
