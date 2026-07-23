import sharp from "sharp";
import {
  InvalidMessageImageError,
  normalizeMessageImage,
} from "./messageImageNormalizer";

describe("normalizeMessageImage", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "decodes %s and emits a bounded WebP without source metadata",
    async (format) => {
      let pipeline = sharp({
        create: {
          width: 2600,
          height: 1300,
          channels: 3,
          background: { r: 20, g: 80, b: 140 },
        },
      });
      pipeline = pipeline.withMetadata({ orientation: 6 });
      const input = await pipeline[format]().toBuffer();

      const result = await normalizeMessageImage(input);
      const metadata = await sharp(result.buffer).metadata();

      expect(result.contentType).toBe("image/webp");
      expect(Math.max(result.width, result.height)).toBe(2048);
      expect(Math.min(result.width, result.height)).toBe(1024);
      expect(metadata.format).toBe("webp");
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
    }
  );

  it("rejects bytes that are not a decodable image", async () => {
    await expect(
      normalizeMessageImage(Buffer.from("not an image"))
    ).rejects.toBeInstanceOf(InvalidMessageImageError);
  });

  it("rejects formats outside the JPEG, PNG, and WebP allowlist", async () => {
    const gif = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: "red",
      },
    })
      .gif()
      .toBuffer();

    await expect(normalizeMessageImage(gif)).rejects.toThrow(
      "Only JPEG, PNG, and WebP images are supported."
    );
  });
});
