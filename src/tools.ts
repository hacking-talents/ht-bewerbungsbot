const MILLISECONDS_IN_A_DAY = 86400000;

export function addDaysToDate(fromDate: Date, days: number) {
  const fromUTC = fromDate.getTime();

  const daysInMs = MILLISECONDS_IN_A_DAY * days;

  return new Date(fromUTC + daysInMs);
}

export function dateToISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}
