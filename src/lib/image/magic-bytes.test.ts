import { describe, expect, it } from "vitest";
import { detectImageType } from "./magic-bytes";

describe("detectImageType", () => {
  it("recognizes a jpeg signature", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectImageType(buf)).toBe("jpeg");
  });

  it("recognizes a png signature", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(detectImageType(buf)).toBe("png");
  });

  it("recognizes a webp (RIFF....WEBP) signature", () => {
    const buf = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WEBP", "ascii"),
    ]);
    expect(detectImageType(buf)).toBe("webp");
  });

  it("rejects an SVG payload regardless of extension/content-type claims", () => {
    const buf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', "utf8");
    expect(detectImageType(buf)).toBeNull();
  });

  it("rejects a RIFF container that isn't WEBP (e.g. a WAV file)", () => {
    const buf = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from("WAVE", "ascii"),
    ]);
    expect(detectImageType(buf)).toBeNull();
  });

  it("rejects garbage bytes", () => {
    expect(detectImageType(Buffer.from([0x00, 0x01, 0x02]))).toBeNull();
  });

  it("rejects an empty buffer", () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});
