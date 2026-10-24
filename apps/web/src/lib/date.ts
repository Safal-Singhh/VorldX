/** Today's date as YYYY-MM-DD in the company's timezone. */
export function todayInTimeZone(timeZone: string | undefined): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** First day of the current month as YYYY-MM-DD in the company's timezone. */
export function monthStartInTimeZone(timeZone: string | undefined): string {
  return `${todayInTimeZone(timeZone).slice(0, 7)}-01`;
}
