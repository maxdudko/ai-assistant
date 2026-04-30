const DATE_PARTS_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function createLocalFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

export function sanitizeTimeZone(input?: string | null): string {
  const candidate = (input ?? '').trim();
  if (!candidate) {
    return 'UTC';
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
}

export function getUserLocalDateInfo(
  now: Date,
  inputTimeZone?: string | null,
): {
  timeZone: string;
  dayStartUtc: Date;
  hour: number;
  minute: number;
  isoDate: string;
} {
  const timeZone = sanitizeTimeZone(inputTimeZone);
  const formatter = createLocalFormatter(timeZone);
  const parts = formatter.formatToParts(now);

  const year = Number(parts.find(part => part.type === 'year')?.value ?? '0');
  const month = Number(parts.find(part => part.type === 'month')?.value ?? '1');
  const day = Number(parts.find(part => part.type === 'day')?.value ?? '1');
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? '0');

  const dayStartUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const isoDate = DATE_PARTS_FORMAT.format(dayStartUtc);

  return { timeZone, dayStartUtc, hour, minute, isoDate };
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
