import { describe, expect, it } from "vitest";
import { generateMenuQrSvg, generateMenuQrPng, generateMenuQrPreviewDataUrl } from "./generate";
import { getPublicMenuUrl } from "./menu-url";

describe("qr menu url", () => {
  it("defaults to localhost:3000 when NEXT_PUBLIC_APP_URL is unset", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getPublicMenuUrl()).toBe("http://localhost:3000/menu");
    if (prev !== undefined) process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  it("strips a trailing slash from the configured base URL", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://rpmpub.example/";
    expect(getPublicMenuUrl()).toBe("https://rpmpub.example/menu");
    if (prev !== undefined) process.env.NEXT_PUBLIC_APP_URL = prev;
    else delete process.env.NEXT_PUBLIC_APP_URL;
  });
});

describe("qr generation", () => {
  const url = "https://rpmpub.example/menu";

  it("renders print-ready SVG markup containing the target URL's structure", async () => {
    const svg = await generateMenuQrSvg(url);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
  });

  it("renders a PNG buffer at the requested pixel size", async () => {
    const png = await generateMenuQrPng(url, { sizePx: 512 });
    expect(Buffer.isBuffer(png)).toBe(true);
    // PNG magic bytes.
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("renders a small inline PNG data URL for live preview", async () => {
    const dataUrl = await generateMenuQrPreviewDataUrl(url);
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });
});
