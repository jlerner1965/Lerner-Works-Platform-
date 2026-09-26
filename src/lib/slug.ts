export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/;

/** Produces a URL slug from free text: lowercase ASCII letters, digits and single hyphens. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}
