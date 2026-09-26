/**
 * Wall-clock time in a named zone, both ways. Plain functions shared by the editor's
 * date-time fields (client) and the CSV and onboarding imports (server): a server module must
 * not import them from a client component module, where they would become client references.
 */

/** datetime-local value for an instant in a zone (YYYY-MM-DDTHH:MM). */
export function toLocalInput(iso: string, timeZone: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
  } catch {
    return "";
  }
}

/** Instant for a wall-clock time in a zone, found by iterating the zone offset. */
export function fromLocalInput(local: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return "";
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const back = toLocalInput(new Date(guess).toISOString(), timeZone);
    if (back === local.slice(0, 16)) break;
    const bm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(back);
    if (!bm) break;
    const [by, bmo, bd, bh, bmi] = bm.slice(1).map(Number) as [number, number, number, number, number];
    guess += Date.UTC(y, mo - 1, d, h, mi) - Date.UTC(by, bmo - 1, bd, bh, bmi);
  }
  return new Date(guess).toISOString();
}
