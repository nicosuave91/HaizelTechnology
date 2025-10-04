import { DateTime } from 'luxon';

type CalendarBrand = { readonly __calendarId?: unique symbol };

export type CalendarId = 'US_FEDERAL' | (string & CalendarBrand);

export interface BusinessDayOptions {
  tz: string;
  calendarId?: CalendarId;
  additionalHolidays?: (string | Date)[];
}

const DEFAULT_CALENDAR_ID: CalendarId = 'US_FEDERAL';

const calendarCache = new Map<string, Set<string>>();

type CalendarGenerator = (year: number) => Iterable<string>;

const calendarGenerators: Record<string, CalendarGenerator> = {
  US_FEDERAL: (year: number) => computeUsFederalHolidays(year),
};

function getCalendarKey(calendarId: CalendarId, year: number): string {
  return `${calendarId}:${year}`;
}

function getHolidaySet(calendarId: CalendarId, year: number): Set<string> {
  const key = getCalendarKey(calendarId, year);
  if (!calendarCache.has(key)) {
    const generator = calendarGenerators[calendarId];
    if (!generator) {
      throw new Error(`Unknown calendar id: ${calendarId}`);
    }
    const holidays = new Set<string>();
    for (const isoDate of generator(year)) {
      holidays.add(isoDate);
    }
    calendarCache.set(key, holidays);
  }
  return calendarCache.get(key)!;
}

function isHoliday(date: DateTime, calendarId: CalendarId): boolean {
  const isoDate = date.toISODate();
  if (!isoDate) {
    return false;
  }
  const yearsToCheck = [date.year, date.year - 1, date.year + 1];
  for (const year of yearsToCheck) {
    const holidays = getHolidaySet(calendarId, year);
    if (holidays.has(isoDate)) {
      return true;
    }
  }
  return false;
}

function computeUsFederalHolidays(year: number): string[] {
  const holidays: DateTime[] = [];

  const newYearsDay = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: 'UTC' });
  holidays.push(applyWeekendObservation(newYearsDay));

  holidays.push(nthWeekdayOfMonth(year, 1, 1, 3)); // Martin Luther King Jr. Day - 3rd Monday Jan
  holidays.push(nthWeekdayOfMonth(year, 2, 1, 3)); // Washington's Birthday - 3rd Monday Feb
  holidays.push(lastWeekdayOfMonth(year, 5, 1)); // Memorial Day - last Monday May

  const juneteenth = DateTime.fromObject({ year, month: 6, day: 19 }, { zone: 'UTC' });
  holidays.push(applyWeekendObservation(juneteenth));

  const independenceDay = DateTime.fromObject({ year, month: 7, day: 4 }, { zone: 'UTC' });
  holidays.push(applyWeekendObservation(independenceDay));

  holidays.push(nthWeekdayOfMonth(year, 9, 1, 1)); // Labor Day - 1st Monday September
  holidays.push(nthWeekdayOfMonth(year, 10, 1, 2)); // Columbus Day - 2nd Monday October

  const veteransDay = DateTime.fromObject({ year, month: 11, day: 11 }, { zone: 'UTC' });
  holidays.push(applyWeekendObservation(veteransDay));

  holidays.push(nthWeekdayOfMonth(year, 11, 4, 4)); // Thanksgiving - 4th Thursday November

  const christmasDay = DateTime.fromObject({ year, month: 12, day: 25 }, { zone: 'UTC' });
  holidays.push(applyWeekendObservation(christmasDay));

  return holidays.map((holiday) => holiday.toISODate()!).filter(Boolean);
}

function applyWeekendObservation(date: DateTime): DateTime {
  if (date.weekday === 6) {
    return date.minus({ days: 1 });
  }
  if (date.weekday === 7) {
    return date.plus({ days: 1 });
  }
  return date;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): DateTime {
  let date = DateTime.fromObject({ year, month, day: 1 }, { zone: 'UTC' });
  while (date.weekday !== weekday) {
    date = date.plus({ days: 1 });
  }
  return date.plus({ days: 7 * (nth - 1) });
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): DateTime {
  let date = DateTime.fromObject({ year, month, day: 1 }, { zone: 'UTC' })
    .plus({ months: 1 })
    .minus({ days: 1 });
  while (date.weekday !== weekday) {
    date = date.minus({ days: 1 });
  }
  return date;
}

function normalizeAdditionalHolidays(additionalHolidays: (string | Date)[], tz: string): Set<string> {
  const set = new Set<string>();
  for (const holiday of additionalHolidays) {
    const dateTime = typeof holiday === 'string'
      ? DateTime.fromISO(holiday, { zone: tz })
      : DateTime.fromJSDate(holiday, { zone: tz });
    const isoDate = dateTime.startOf('day').toISODate();
    if (isoDate) {
      set.add(isoDate);
    }
  }
  return set;
}

export function isBusinessDay(date: Date | string, options: BusinessDayOptions): boolean {
  const { tz, calendarId = DEFAULT_CALENDAR_ID, additionalHolidays = [] } = options;
  const dateTime =
    typeof date === 'string'
      ? DateTime.fromISO(date, { zone: tz })
      : DateTime.fromJSDate(date, { zone: tz });

  if (!dateTime.isValid) {
    throw new Error('Invalid date supplied to isBusinessDay');
  }

  if (dateTime.weekday === 6 || dateTime.weekday === 7) {
    return false;
  }

  const isoDate = dateTime.toISODate();
  if (!isoDate) {
    return false;
  }

  if (normalizeAdditionalHolidays(additionalHolidays, tz).has(isoDate)) {
    return false;
  }

  return !isHoliday(dateTime, calendarId);
}

export function addBusinessDays(
  date: Date | string,
  amount: number,
  options: BusinessDayOptions,
): Date {
  if (!Number.isInteger(amount)) {
    throw new Error('amount must be an integer');
  }
  const { tz, calendarId = DEFAULT_CALENDAR_ID, additionalHolidays = [] } = options;
  let dateTime =
    typeof date === 'string'
      ? DateTime.fromISO(date, { zone: tz })
      : DateTime.fromJSDate(date, { zone: tz });

  if (!dateTime.isValid) {
    throw new Error('Invalid date supplied to addBusinessDays');
  }

  if (amount === 0) {
    return dateTime.toJSDate();
  }

  const direction = amount > 0 ? 1 : -1;
  let remaining = Math.abs(amount);
  const additionalHolidaySet = normalizeAdditionalHolidays(additionalHolidays, tz);

  while (remaining > 0) {
    dateTime = dateTime.plus({ days: direction });
    if (dateTime.weekday === 6 || dateTime.weekday === 7) {
      continue;
    }

    const isoDate = dateTime.toISODate();
    if (!isoDate) {
      continue;
    }
    if (additionalHolidaySet.has(isoDate)) {
      continue;
    }
    if (isHoliday(dateTime, calendarId)) {
      continue;
    }

    remaining -= 1;
  }

  return dateTime.toJSDate();
}

export function businessDaysBetween(
  start: Date | string,
  end: Date | string,
  options: BusinessDayOptions,
): number {
  const { tz, calendarId = DEFAULT_CALENDAR_ID, additionalHolidays = [] } = options;
  const startDate =
    typeof start === 'string'
      ? DateTime.fromISO(start, { zone: tz })
      : DateTime.fromJSDate(start, { zone: tz });
  const endDate =
    typeof end === 'string'
      ? DateTime.fromISO(end, { zone: tz })
      : DateTime.fromJSDate(end, { zone: tz });

  if (!startDate.isValid || !endDate.isValid) {
    throw new Error('Invalid date supplied to businessDaysBetween');
  }

  let days = 0;
  let cursor = startDate.startOf('day');
  const endDay = endDate.startOf('day');
  const direction = cursor <= endDay ? 1 : -1;
  const additionalHolidaySet = normalizeAdditionalHolidays(additionalHolidays, tz);

  while (!cursor.hasSame(endDay, 'day')) {
    cursor = cursor.plus({ days: direction });
    if (cursor.weekday === 6 || cursor.weekday === 7) {
      continue;
    }
    const isoDate = cursor.toISODate();
    if (!isoDate) {
      continue;
    }
    if (additionalHolidaySet.has(isoDate)) {
      continue;
    }
    if (isHoliday(cursor, calendarId)) {
      continue;
    }
    days += direction;
  }

  return days;
}
