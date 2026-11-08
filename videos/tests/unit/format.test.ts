import { describe, expect, it } from "vitest";
import { formatBytes, formatDate } from "@/lib/format";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1.0 KB"],
    [1536, "1.5 KB"],
    [50 * 1024 ** 2, "50.0 MB"],
    [3.25 * 1024 ** 3, "3.3 GB"],
    [2 * 1024 ** 4, "2.0 TB"],
  ])("%d bytes → %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("no pasa de TB aunque el valor sea enorme", () => {
    expect(formatBytes(5 * 1024 ** 5)).toBe("5120.0 TB");
  });

  it("respeta el número de decimales", () => {
    expect(formatBytes(1536, 2)).toBe("1.50 KB");
  });
});

describe("formatDate", () => {
  it("formatea en español con día, mes abreviado y año", () => {
    const text = formatDate("2026-03-05T12:00:00.000Z");
    expect(text).toMatch(/05/);
    expect(text).toMatch(/mar/i);
    expect(text).toMatch(/2026/);
  });
});
