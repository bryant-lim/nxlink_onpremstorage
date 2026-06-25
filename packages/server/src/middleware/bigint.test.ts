import { describe, it, expect } from "vitest";
import { convertBigInts } from "./bigint.js";

describe("BigInt Conversion", () => {
  it("should convert bigint to number", () => {
    expect(convertBigInts(BigInt(123))).toBe(123);
  });

  it("should convert Date to ISO string", () => {
    const date = new Date("2026-04-02T10:00:00.000Z");
    expect(convertBigInts(date)).toBe("2026-04-02T10:00:00.000Z");
  });

  it("should handle nested objects with bigint", () => {
    const input = {
      id: BigInt(1),
      name: "test",
      nested: {
        count: BigInt(42),
      },
    };

    const result = convertBigInts(input);

    expect(result).toEqual({
      id: 1,
      name: "test",
      nested: {
        count: 42,
      },
    });
  });

  it("should handle arrays with bigint", () => {
    const input = [BigInt(1), BigInt(2), "test"];
    const result = convertBigInts(input);
    expect(result).toEqual([1, 2, "test"]);
  });

  it("should handle null and undefined", () => {
    expect(convertBigInts(null)).toBe(null);
    expect(convertBigInts(undefined)).toBe(undefined);
  });

  it("should handle primitives", () => {
    expect(convertBigInts(42)).toBe(42);
    expect(convertBigInts("test")).toBe("test");
    expect(convertBigInts(true)).toBe(true);
  });
});
