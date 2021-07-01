export const MILLISECONDS_IN_A_DAY = 86400000;
const DEFAULT_DURATION_IN_DAYS = 8;

export function calculateDueDate(
  dueDate?: Date,
  fromDate: Date = new Date(),
): Date {
  if (dueDate == undefined) {
    const fromUTC = fromDate.getTime();

    const defaultHomeworkDurationInMs = MILLISECONDS_IN_A_DAY *
      DEFAULT_DURATION_IN_DAYS;

    dueDate = new Date(fromUTC + defaultHomeworkDurationInMs);
  }

  // Shift to last moment on due date
  const dueTime = new Date(dueDate.setHours(23, 59, 59, 999));

  return dueTime;
}

export function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}
