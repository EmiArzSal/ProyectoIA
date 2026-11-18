// Calendar days for the whole app. Daily quotas and practice streaks must agree
// on when "today" starts, so both use this time zone and these helpers.
// Pure functions only (no server imports) so they can be unit-tested.

export const APP_TIME_ZONE = "America/Mexico_City";

/** A calendar day as "YYYY-MM-DD". */
export type IsoDate = string;

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** Calendar day of `date` in `timeZone`, as "YYYY-MM-DD". */
export function localDate(date: Date, timeZone = APP_TIME_ZONE): IsoDate {
  let fmt = dayFormatters.get(timeZone);
  if (!fmt) {
    // en-CA formats dates as YYYY-MM-DD.
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(timeZone, fmt);
  }
  return fmt.format(date);
}

/** `day` moved by `n` calendar days (n may be negative). */
export function addDays(day: IsoDate, n: number): IsoDate {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Instant of the most recent local midnight in `timeZone`. */
export function startOfToday(timeZone = APP_TIME_ZONE, now = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );

  const y = Number(parts.year);
  const m = Number(parts.month) - 1;
  const d = Number(parts.day);
  const localAsUTC = Date.UTC(y, m, d, Number(parts.hour), Number(parts.minute), Number(parts.second));
  const offsetMs = localAsUTC - Math.floor(now.getTime() / 1000) * 1000;

  return new Date(Date.UTC(y, m, d) - offsetMs);
}
