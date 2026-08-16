import { describe, expect, it } from "vitest";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { withPostStudioPropType } from "$lib/shared/share/components/post-studio/post-studio-prop-render-options";

describe("withPostStudioPropType", () => {
  it("pins one prop into every live and exported card override", () => {
    const result = withPostStudioPropType(
      {
        addWord: false,
        visibilityOverrides: {
          darkMode: true,
          showQRCode: true,
          bluePropType: PropType.STAFF,
          redPropType: PropType.CLUB,
        },
      },
      PropType.FAN
    );

    expect(result.addWord).toBe(false);
    expect(result.propTypeOverride).toBe(PropType.FAN);
    expect(result.bluePropTypeOverride).toBe(PropType.FAN);
    expect(result.redPropTypeOverride).toBe(PropType.FAN);
    expect(result.visibilityOverrides).toMatchObject({
      darkMode: true,
      showQRCode: true,
      bluePropType: PropType.FAN,
      redPropType: PropType.FAN,
    });
  });
});
