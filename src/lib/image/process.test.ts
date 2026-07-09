import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { processImage, MAX_INPUT_BYTES, VARIANT_SPECS } from "./process";
import { ImageTooLargeError, UnsupportedImageTypeError } from "./errors";

async function makeJpeg(width = 400, height = 300): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 20, b: 20 } } })
    .jpeg()
    .toBuffer();
}

async function makePng(width = 100, height = 100): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 1 } } })
    .png()
    .toBuffer();
}

async function makeWebp(width = 100, height = 100): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 10, b: 10 } } })
    .webp()
    .toBuffer();
}

describe("processImage", () => {
  it("produces thumb/card/display webp variants for a jpeg input", async () => {
    const input = await makeJpeg(2400, 1600);
    const result = await processImage(input);

    expect(result.sourceType).toBe("jpeg");
    expect(result.variants.map((v) => v.name)).toEqual(VARIANT_SPECS.map((s) => s.name));

    for (const variant of result.variants) {
      expect(variant.contentType).toBe("image/webp");
      const meta = await sharp(variant.buffer).metadata();
      expect(meta.format).toBe("webp");
    }

    // display (~1920w cap) should be downscaled from the 2400px source.
    const display = result.variants.find((v) => v.name === "display")!;
    expect(display.width).toBeLessThanOrEqual(1920);
    // thumb should be the smallest.
    const thumb = result.variants.find((v) => v.name === "thumb")!;
    expect(thumb.width).toBeLessThanOrEqual(200);
  });

  it("accepts png input", async () => {
    const input = await makePng();
    const result = await processImage(input);
    expect(result.sourceType).toBe("png");
    expect(result.variants).toHaveLength(3);
  });

  it("accepts webp input", async () => {
    const input = await makeWebp();
    const result = await processImage(input);
    expect(result.sourceType).toBe("webp");
    expect(result.variants).toHaveLength(3);
  });

  it("does not upscale an image smaller than a variant's target width", async () => {
    const input = await makeJpeg(50, 40);
    const result = await processImage(input);
    for (const variant of result.variants) {
      expect(variant.width).toBeLessThanOrEqual(50);
    }
  });

  it("strips EXIF and bakes in orientation instead of leaving it in metadata", async () => {
    // Orientation 6 = "rotate 90 CW" — sharp's auto-orient should swap the
    // effective width/height, and the stripped output must carry no exif.
    const input = await sharp({
      create: { width: 120, height: 60, channels: 3, background: { r: 5, g: 5, b: 5 } },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await processImage(input);
    const thumb = result.variants.find((v) => v.name === "thumb")!;

    // Orientation baked in: 120x60 source rotates to an effective 60x120.
    expect(thumb.width).toBe(60);
    expect(thumb.height).toBe(120);

    const meta = await sharp(thumb.buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation ?? 1).toBe(1);
  });

  it("rejects input over the 10MB-in limit before attempting to decode", async () => {
    const oversized = Buffer.alloc(MAX_INPUT_BYTES + 1, 0);
    // Give it a valid jpeg magic-byte prefix so a size-check bypass would
    // otherwise fall through to (and fail on) the decode step.
    oversized[0] = 0xff;
    oversized[1] = 0xd8;
    oversized[2] = 0xff;
    await expect(processImage(oversized)).rejects.toBeInstanceOf(ImageTooLargeError);
  });

  it("rejects an SVG payload", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', "utf8");
    await expect(processImage(svg)).rejects.toBeInstanceOf(UnsupportedImageTypeError);
  });

  it("rejects non-image garbage bytes", async () => {
    const garbage = Buffer.from("not an image, just text pretending to be one");
    await expect(processImage(garbage)).rejects.toBeInstanceOf(UnsupportedImageTypeError);
  });

  it("rejects a gif (real image format, but not in the jpeg/png/webp allow-list)", async () => {
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } })
      .gif()
      .toBuffer();
    await expect(processImage(gif)).rejects.toBeInstanceOf(UnsupportedImageTypeError);
  });
});
