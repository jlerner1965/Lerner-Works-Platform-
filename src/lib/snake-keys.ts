/**
 * The database client camel-cases the keys of json objects it reads (`transform:
 * postgres.camel` applies to jsonb values as well as to column names). Maps stored under CSV
 * column names or settings keys ("external_id", "primary_color") therefore come back as
 * "externalId", "primaryColor". This puts the snake_case keys back; every key the imports
 * store is a lowercase word chain with digits, for which the round trip is exact (a unit test
 * proves it for every CSV column and settings key).
 */
export function snakeCaseKeys<T>(obj: Record<string, T> | null | undefined): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(obj ?? {})) out[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = v;
  return out;
}
