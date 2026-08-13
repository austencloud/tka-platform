import { describe, expect, it } from "vitest";

import {
  DEPLOY_DIRECTORY_FILE_ALLOWLISTS,
  getDisallowedDeployEntries,
} from "../../scripts/deploy-asset-trim-policy.js";

describe("deploy asset trimming policy", () => {
  it("ships only the Autumn floor texture fetched by the browser", () => {
    expect(DEPLOY_DIRECTORY_FILE_ALLOWLISTS["textures/autumn-floor"]).toEqual([
      "ground-detail-modulation.ktx2",
    ]);

    expect(
      getDisallowedDeployEntries(
        [
          "autumn-ground-zoned.jpg",
          "ground-detail-modulation.ktx2",
          "ground-detail-modulation.png",
          "soil-albedo.jpg",
        ],
        DEPLOY_DIRECTORY_FILE_ALLOWLISTS["textures/autumn-floor"]
      )
    ).toEqual([
      "autumn-ground-zoned.jpg",
      "ground-detail-modulation.png",
      "soil-albedo.jpg",
    ]);
  });
});
