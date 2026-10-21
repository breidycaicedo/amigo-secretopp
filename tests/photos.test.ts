import { describe, expect, it } from "vitest";
import { detectImageType } from "@/lib/image-type";

describe("detección real del formato de imagen", () => {
  it("reconoce JPG, PNG y WebP por sus bytes", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
    expect(detectImageType(webp)?.mime).toBe("image/webp");
  });

  it("rechaza archivos que no son imágenes aunque se llamen .jpg", () => {
    expect(detectImageType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });
});
