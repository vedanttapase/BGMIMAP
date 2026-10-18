import { describe, expect, it } from "vitest";
import { distance, toMeters } from "./geo";

describe("map geometry helpers", () => {
  it("calculates Euclidean distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
  it("converts calibrated map distance", () => {
    expect(toMeters(25, 2)).toBe(50);
  });
  it("rejects invalid scales", () => {
    expect(() => toMeters(2, 0)).toThrow(RangeError);
    expect(() => toMeters(-1, 1)).toThrow(RangeError);
  });
});
