import { describe, expect, it } from "vitest";
import { propTileArtwork, propGlyphArtwork } from "../prop-look";
import { PROP_MODEL_SPRITES } from "../prop-model-sprites.generated";

const glyph = "/images/props/buttons/x.svg";

describe("navigation prop artwork", () => {
  it.each(["fan", "bigfan"])(
    "keeps flat grips in both %s glyphs without substituting a tile photo",
    (type) => {
      const appearance = {
        fanAppearance: {
          build: "flat-grip" as const,
          frameColor: "black" as const,
          cover: "bare" as const,
        },
      };
      for (const side of ["left", "right"] as const) {
        const art = propGlyphArtwork(type, side, appearance, glyph);
        expect(art.href).toContain("fan-flat-grip.svg");
        expect(art.fill).toBeUndefined();
        expect(art.prelit).toBe(false);
        expect(art.crop!.x).toBeGreaterThan(0);
      }
    }
  );

  it("keeps the cover and notation choices distinct", () => {
    const fanAppearance = {
      build: "fire" as const,
      frameColor: "black" as const,
      cover: "covered" as const,
    };
    expect(
      propGlyphArtwork("fan", "left", { fanAppearance }, glyph).href
    ).toContain("fan-fire-covered.svg");
    expect(
      propGlyphArtwork(
        "fan",
        "left",
        { fanAppearance: { ...fanAppearance, build: "pictograph" } },
        glyph
      ).href
    ).toBe(glyph);
  });

  it("retains the selected model and its per-hand crop for non-fans", () => {
    const appearance = { propLook: "model" as const };
    for (const side of ["left", "right"] as const) {
      expect(propGlyphArtwork("club", side, appearance, glyph)).toEqual(
        propTileArtwork("club", side, appearance, glyph)
      );
    }
  });
});

describe("propTileArtwork", () => {
  it("draws the pre-lit model capture per hand for the model look", () => {
    const look = { propLook: "model" as const };
    const left = propTileArtwork("club", "left", look, glyph);
    const right = propTileArtwork("club", "right", look, glyph);
    expect(left.href).toMatch(/\/model\/club-blue\.svg/);
    expect(right.href).toMatch(/\/model\/club-red\.svg/);
    expect(left).toMatchObject({ styled: true, prelit: true });
  });

  it("crops a model capture to the window that holds the prop", () => {
    const club = propTileArtwork("club", "left", { propLook: "model" }, glyph);
    const entry = PROP_MODEL_SPRITES.club!;
    expect(club.crop).toEqual({
      imageWidth: entry.width,
      imageHeight: entry.height,
      ...entry.bounds,
    });
    // A one-sided prop paints only half of its grip-centred box.
    expect(club.crop!.width).toBeLessThan(entry.width * 0.6);
    // Every captured sprite carries its painted window.
    for (const [prop, sprite] of Object.entries(PROP_MODEL_SPRITES)) {
      expect(sprite.bounds, prop).toBeDefined();
    }
    // Notation glyphs are already cropped artwork.
    expect(propTileArtwork("club", "left", {}, glyph).crop).toBeUndefined();
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
    expect(propTileArtwork("energy_saber", "left", {}, glyph).href).toBe(glyph);
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
