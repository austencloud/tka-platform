import { describe, expect, it } from "vitest";
import { propTileArtwork } from "../prop-look";

const glyph = "/images/props/buttons/x.svg";

describe("propTileArtwork", () => {
  it("draws the pre-lit model capture per hand for the model look", () => {
    const look = { propLook: "model" as const };
    const left = propTileArtwork("club", "left", look, glyph);
    const right = propTileArtwork("club", "right", look, glyph);
    expect(left.href).toMatch(/\/model\/club-blue\.svg/);
    expect(right.href).toMatch(/\/model\/club-red\.svg/);
    expect(left).toMatchObject({ styled: true, prelit: true });
  });

  it("uses the notation glyph by default and for the pictograph look", () => {
    expect(propTileArtwork("club", "left", {}, glyph)).toEqual({
      href: glyph,
      styled: false,
      prelit: false,
    });
    expect(
      propTileArtwork("club", "left", { propLook: "pictograph" }, glyph)
    ).toEqual({ href: glyph, styled: false, prelit: false });
    expect(propTileArtwork("energy_saber", "left", {}, glyph).href).toBe(
      glyph
    );
  });

  it("draws the rendered preview of the chosen fan build", () => {
    const fire = propTileArtwork("bigfan", "right", {}, glyph);
    expect(fire.href).toMatch(/build-previews\/fan-fire-bare-complete\.webp/);
    expect(fire).toMatchObject({ styled: true, prelit: true });
    expect(
      propTileArtwork(
        "fan",
        "left",
        {
          fanAppearance: {
            build: "pictograph",
            frameColor: "black",
            cover: "bare",
          },
        },
        glyph
      ).href
    ).toBe(glyph);
  });
});
