import { describe, expect, it } from 'vitest';
import { formatMoney, formatDate, shortDate } from './format';

describe('money and dates', () => {
  it('formats cents as dollars', () => {
    expect(formatMoney(14600)).toBe('$146.00');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(-3600)).toBe('-$36.00');
  });

  it('formats the sample dates', () => {
    expect(formatDate('2026-10-02')).toBe('October 2, 2026');
    expect(shortDate('2026-10-02')).toBe('Oct 2');
  });
});
