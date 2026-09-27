import { describe, expect, it } from "vitest";
import { openSecret, sealSecret, secretTail } from "@/server/secrets/crypto";

/** Organization secrets (B8): sealed under a key derived from SESSION_SECRET, unreadable under another. */
describe("sealing a secret", () => {
  const secret = "a-session-secret-of-at-least-thirty-two-characters";

  it("round-trips, never repeats a ciphertext, and shows only the tail", () => {
    const sealed = sealSecret("github_pat_ABCDEFGHIJKLMNOP1234", secret);
    expect(sealed).toMatch(/^v1:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]+$/);
    expect(openSecret(sealed, secret)).toBe("github_pat_ABCDEFGHIJKLMNOP1234");
    expect(sealSecret("github_pat_ABCDEFGHIJKLMNOP1234", secret)).not.toBe(sealed);
    expect(secretTail("github_pat_ABCDEFGHIJKLMNOP1234")).toBe("1234");
    expect(secretTail("short")).toBe("");
  });

  it("refuses another key, a damaged ciphertext and an unknown format", () => {
    const sealed = sealSecret("token-value-1234567890", secret);
    expect(() => openSecret(sealed, "another-session-secret-that-is-also-long")).toThrow(/current SESSION_SECRET/);
    const [v, iv, body] = sealed.split(":");
    const flipped = `${v}:${iv}:${body!.slice(0, -2)}${body!.endsWith("AA") ? "BB" : "AA"}`;
    expect(() => openSecret(flipped, secret)).toThrow();
    expect(() => openSecret("v0:abc:def", secret)).toThrow(/unknown format/);
    expect(() => openSecret("v1:short:x", secret)).toThrow(/damaged/);
  });
});
