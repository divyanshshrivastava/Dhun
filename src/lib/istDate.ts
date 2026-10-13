// Indian Standard Time (IST) Date & Midnight Boundary Utilities
// IST is UTC+05:30 with no daylight saving shifts

const IST_TIMEZONE = 'Asia/Kolkata';

// Returns the date in YYYY-MM-DD format as seen in India (Asia/Kolkata)
export function getCurrentIstDateString(referenceDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(referenceDate);
}

// Returns milliseconds remaining until the next 00:00:00 IST midnight
export function getMsUntilNextMidnightIst(referenceDate: Date = new Date()): number {
  const currentIstDateStr = getCurrentIstDateString(referenceDate);
  const [yearStr, monthStr, dayStr] = currentIstDateStr.split('-');

  const currentYear = parseInt(yearStr, 10);
  const currentMonth = parseInt(monthStr, 10);
  const currentDay = parseInt(dayStr, 10);

  // Compute next day
  const tomorrowUtcDate = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay + 1, 0, 0, 0));
  // Midnight in IST is 18:30:00 UTC of the previous UTC day (because IST is UTC + 5h30m)
  // i.e., Next Midnight IST = (Tomorrow 00:00 IST) - 5h30m = Today 18:30:00 UTC
  const nextMidnightIstUtcMs = tomorrowUtcDate.getTime() - (5 * 60 + 30) * 60 * 1000;

  return Math.max(0, nextMidnightIstUtcMs - referenceDate.getTime());
}
