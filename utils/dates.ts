/** Date helpers computed in West Africa Time (UTC+1, no DST). */
const WAT_OFFSET_MS = 60 * 60 * 1000;

export function watToday(now = new Date()): Date {
  const wat = new Date(now.getTime() + WAT_OFFSET_MS);
  return new Date(Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate()));
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

/** yyyy-mm-dd, the value format of <input type="date"> and URL params. */
export const iso = (d: Date) => d.toISOString().slice(0, 10);

/** A stay `nights` long starting `offset` days from today (WAT). */
export function stay(offset: number, nights: number) {
  const checkIn = addDays(watToday(), offset);
  return { checkIn: iso(checkIn), checkOut: iso(addDays(checkIn, nights)), nights };
}
