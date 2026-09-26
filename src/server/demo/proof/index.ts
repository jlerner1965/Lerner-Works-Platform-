import path from "node:path";
import { cedarBend } from "./cedar-bend";
import { bookcliff } from "./bookcliff";
import type { ProofSite } from "./types";

export * from "./types";
export * from "./package";

/** The two proof sites: a community guide and a location business (site-building programme B4). */
export const proofSites: ProofSite[] = [cedarBend, bookcliff];

/** Where a proof site's photographs are committed (web-sized JPEGs made by scripts/fetch-proof-photos.ts). */
export function proofPhotoDir(siteKey: string): string {
  return path.join(process.cwd(), "src", "server", "demo", "proof", "photos", siteKey);
}
