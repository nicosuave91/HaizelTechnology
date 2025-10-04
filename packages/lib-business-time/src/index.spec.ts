import { describe, expect, it } from 'vitest';
import { addBusinessDays, businessDaysBetween, isBusinessDay } from './index';

const TZ = 'America/New_York';

describe('business-day utilities', () => {
  it('skips weekends when adding business days', () => {
    const start = new Date('2024-01-05T10:00:00-05:00'); // Friday
    const result = addBusinessDays(start, 1, { tz: TZ });

    expect(result.toISOString()).toBe('2024-01-08T15:00:00.000Z');
  });

  it('skips US federal holidays (observed)', () => {
    const start = new Date('2024-07-03T10:00:00-04:00');
    const result = addBusinessDays(start, 1, { tz: TZ });

    // July 4th, 2024 is a Thursday holiday; next business day is July 5th
    expect(result.toISOString()).toBe('2024-07-05T14:00:00.000Z');
  });

  it('handles daylight saving time transitions without shifting the wall-clock hour', () => {
    const start = new Date('2024-03-08T15:00:00-05:00'); // Before DST spring forward
    const result = addBusinessDays(start, 1, { tz: TZ });

    // March 11th is the next business day after the weekend; wall-clock remains 15:00 in the target TZ
    expect(result.toISOString()).toBe('2024-03-11T19:00:00.000Z');
  });

  it('computes business days between two dates', () => {
    const days = businessDaysBetween('2024-03-08', '2024-03-13', { tz: TZ });
    expect(days).toBe(3);
  });

  it('recognizes custom additional holidays', () => {
    const start = new Date('2024-05-22T15:00:00Z');
    const result = addBusinessDays(start, 1, {
      tz: TZ,
      additionalHolidays: ['2024-05-23'],
    });

    expect(result.toISOString()).toBe('2024-05-24T15:00:00.000Z');
    expect(isBusinessDay('2024-05-23', { tz: TZ, additionalHolidays: ['2024-05-23'] })).toBe(false);
  });
});
