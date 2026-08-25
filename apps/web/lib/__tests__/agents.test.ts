import { describe, expect, it } from "vitest";
import { dedupeAndCapSlugs } from "../agents";

describe("dedupeAndCapSlugs", () => {
  it("removes duplicates before applying the cap", () => {
    // Regression: previously slicing happened before dedup, so
    // ?agents=a,a,a,b,c produced ["a","a","a"] instead of ["a","b","c"].
    expect(dedupeAndCapSlugs(["a", "a", "a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("enforces the max count server-side regardless of how many unique slugs are requested", () => {
    expect(dedupeAndCapSlugs(["a", "b", "c", "d", "e"])).toHaveLength(3);
  });

  it("preserves first-seen order", () => {
    expect(dedupeAndCapSlugs(["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });

  it("handles an empty list safely", () => {
    expect(dedupeAndCapSlugs([])).toEqual([]);
  });

  it("respects a custom max when provided", () => {
    expect(dedupeAndCapSlugs(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]);
  });
});
