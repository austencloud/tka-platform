import { describe, it, expect } from "vitest";
import { getOceanQualityConfig } from "$lib/shared/3d/environments/scenes/ocean/quality/ocean-quality";

describe("ocean quality flora variant", () => {
	it("serves the hi flora build only to the ultra tier", () => {
		expect(getOceanQualityConfig("ultra").floraVariant).toBe("hi");
		expect(getOceanQualityConfig("medium").floraVariant).toBe("base");
		expect(getOceanQualityConfig("low").floraVariant).toBe("base");
	});
});
