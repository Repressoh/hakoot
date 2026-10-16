// @vitest-environment node
import { describe, expect, test } from "vitest";
import { formatLineNumbers, parseLineRange } from "./utils";

describe("parseLineRange", () => {
  test("reads single lines and ranges, sorted and without duplicates", () => {
    expect(parseLineRange("10-12, 5, 11")).toEqual([5, 10, 11, 12]);
  });

  test("ignores empty parts instead of reading them as line 0", () => {
    expect(parseLineRange("")).toEqual([]);
    expect(parseLineRange("5, ")).toEqual([5]);
    expect(parseLineRange(",,3")).toEqual([3]);
  });

  test("ignores half-typed and invalid parts", () => {
    expect(parseLineRange("5-")).toEqual([]);
    expect(parseLineRange("abc, 2")).toEqual([2]);
    expect(parseLineRange("0")).toEqual([]);
  });

  test("keeps lines within 1 to 5000, however large the range typed", () => {
    expect(parseLineRange("-3")).toEqual([1, 2, 3]);
    expect(parseLineRange("4999-10000000")).toEqual([4999, 5000]);
    expect(parseLineRange("1-Infinity")).toHaveLength(5000);
    expect(parseLineRange("5001, 1e9")).toEqual([]);
  });

  test("round-trips through formatLineNumbers", () => {
    expect(formatLineNumbers(parseLineRange("1-3, 7, 9-10"))).toBe(
      "1-3, 7, 9-10"
    );
  });
});
