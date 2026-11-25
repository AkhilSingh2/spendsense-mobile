import { formatMoney, parseAmountText, toMinor } from '@/domain/money';
import { convertMinor } from '@/domain/rates';

describe('money', () => {
  test('stores rupees as paise and formats without a trailing zero', () => {
    expect(toMinor(450, 'INR')).toBe(45000);
    expect(formatMoney(45000, 'INR')).toContain('450');
    expect(formatMoney(45050, 'INR')).toContain('450.50');
  });

  test('yen has no minor units', () => {
    expect(toMinor(450, 'JPY')).toBe(450);
    expect(parseAmountText('12.5', 'JPY')).toBe(13);
  });

  test('rejects empty and zero amounts', () => {
    expect(parseAmountText('', 'INR')).toBeNull();
    expect(parseAmountText('0', 'INR')).toBeNull();
    expect(parseAmountText('1,200.5', 'INR')).toBe(120050);
  });

  test('converts a dollar into rupees with the bundled rate', () => {
    expect(convertMinor(100, 'USD', 'INR')).toBe(8420);
    expect(convertMinor(45000, 'INR', 'INR')).toBe(45000);
  });
});
