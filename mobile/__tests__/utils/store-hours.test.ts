import { computeIsOpen, type OpeningHours } from '@/utils/store-hours';

describe('computeIsOpen', () => {
  it('returns null when opening_hours is not set', () => {
    expect(computeIsOpen(null)).toBeNull();
    expect(computeIsOpen(undefined)).toBeNull();
  });

  it('returns false for a day with no hours entry (explicitly closed)', () => {
    const hours: OpeningHours = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
    expect(computeIsOpen(hours)).toBe(false);
  });

  it('returns a boolean for a fully-populated week (never Invalid-Date/null on a real engine)', () => {
    const hours: OpeningHours = {
      0: { open: '08:00', close: '13:00' },
      1: { open: '08:00', close: '22:00' },
      2: { open: '08:00', close: '22:00' },
      3: { open: '08:00', close: '22:00' },
      4: { open: '08:00', close: '22:00' },
      5: { open: '08:00', close: '22:00' },
      6: { open: '08:00', close: '22:00' },
    };
    expect(typeof computeIsOpen(hours)).toBe('boolean');
  });
});
