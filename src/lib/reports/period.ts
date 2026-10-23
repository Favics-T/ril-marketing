export function completedReportPeriod(today: string, period: "weekly" | "monthly") {
  const end = new Date(`${today}T12:00:00Z`);
  const start = new Date(end);
  if (period === "monthly") {
    start.setUTCDate(1);
    end.setUTCDate(0);
    start.setUTCMonth(start.getUTCMonth() - 1);
  } else {
    const daysSinceMonday = (end.getUTCDay() + 6) % 7;
    end.setUTCDate(end.getUTCDate() - daysSinceMonday - 1);
    start.setTime(end.getTime());
    start.setUTCDate(start.getUTCDate() - 6);
  }
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
