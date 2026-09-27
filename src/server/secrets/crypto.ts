import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { getConfig } from "@/server/config";

/**
 * Secrets an organization stores with the platform (B8: a GitHub token) are sealed with
 * AES-256-GCM under a key derived from SESSION_SECRET, so no second secret has to be
 * configured. Rotating SESSION_SECRET makes stored tokens unreadable; they are pasted again.
 * The sealed form is `v1:<iv>:<ciphertext+tag>`, both base64url.
 */

const VERSION = "v1";
const SALT = "lernerworks-organization-secrets";
const INFO = "aes-256-gcm";

function derivedKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, SALT, INFO, 32));
}

export function sealSecret(plaintext: string, secret: string = getConfig().SESSION_SECRET): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derivedKey(secret), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `${VERSION}:${iv.toString("base64url")}:${body.toString("base64url")}`;
}

export function openSecret(sealed: string, secret: string = getConfig().SESSION_SECRET): string {
  const [version, ivPart, bodyPart] = sealed.split(":");
  if (version !== VERSION || !ivPart || !bodyPart) throw new Error("The stored secret has an unknown format.");
  const iv = Buffer.from(ivPart, "base64url");
  const body = Buffer.from(bodyPart, "base64url");
  if (iv.length !== 12 || body.length < 17) throw new Error("The stored secret is damaged.");
  const decipher = createDecipheriv("aes-256-gcm", derivedKey(secret), iv);
  decipher.setAuthTag(body.subarray(body.length - 16));
  try {
    return Buffer.concat([decipher.update(body.subarray(0, body.length - 16)), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("The stored secret cannot be read with the current SESSION_SECRET; paste it again.");
  }
}

/** The tail of a secret shown so a person can tell which one is stored; never more than four characters. */
export function secretTail(plaintext: string): string {
  return plaintext.length >= 8 ? plaintext.slice(-4) : "";
}
