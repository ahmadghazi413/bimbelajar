import { describe, expect, it } from "vitest";
import { rupiah, toEmbedUrl } from "@/lib/format";

describe("toEmbedUrl", () => {
  it("YouTube", () => {
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
  });
  it("Vimeo", () => {
    expect(toEmbedUrl("https://vimeo.com/123456/abcdef")).toBe("https://player.vimeo.com/video/123456?h=abcdef");
  });
  it("Google Drive", () => {
    expect(toEmbedUrl("https://drive.google.com/file/d/AbC_123/view?usp=sharing")).toBe("https://drive.google.com/file/d/AbC_123/preview");
  });
  it("link tidak dikenal", () => {
    expect(toEmbedUrl("https://example.com/x")).toBeNull();
  });
});

describe("rupiah", () => {
  it("format harga kelas", () => {
    expect(rupiah(100000)).toBe("Rp100.000");
  });
});
