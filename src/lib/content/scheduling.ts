export function futureSchedule(value: string, now = Date.now()): string {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error("Choose a date and time with a timezone.");
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time <= now + 60_000) throw new Error("Choose a publishing time at least one minute in the future.");
  return new Date(time).toISOString();
}

export function localSchedule(value: string): string {
  const time = new Date(value);
  if (!value || !Number.isFinite(time.getTime())) throw new Error("Choose a valid date and time.");
  return time.toISOString();
}
