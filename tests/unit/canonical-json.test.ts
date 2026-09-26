import { describe, expect, it } from "vitest";
import { canonicalJson, hashCanonical } from "@/lib/canonical-json";

describe("canonical JSON", () => {
  it("sorts keys recursively and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [3, { z: 1, y: 2 }] } })).toBe('{"a":{"c":[3,{"y":2,"z":1}]},"b":1}');
  });
  it("hashes equal structures identically regardless of key order", () => {
    expect(hashCanonical({ x: 1, y: [1, 2] })).toBe(hashCanonical({ y: [1, 2], x: 1 }));
    expect(hashCanonical({ x: 1 })).not.toBe(hashCanonical({ x: 2 }));
  });
});
