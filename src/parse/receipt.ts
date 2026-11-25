import { toMinor } from '@/domain/money';
import type { ParsedExpense } from '@/parse/rules';

export type ReceiptExtraction = {
  expense: Partial<ParsedExpense>;
  message: string;
  sample: boolean;
};

const SAMPLE: ParsedExpense = {
  amountMinor: toMinor(450, 'INR'),
  currency: 'INR',
  type: 'expense',
  categoryId: 'food',
  note: 'Lunch thali',
  merchant: 'Tandoor Room',
  occurredOn: '2026-11-24',
  cadence: null,
  confidence: 0.92,
  interpretation: 'Sample receipt · Tandoor Room · ₹450',
};

/**
 * On-device stand-in for OCR. The bundled sample receipt returns a known
 * extraction. Any other photo is stored and left for the person to confirm.
 * A future OCR endpoint can replace this function without touching the screen.
 */
export function extractReceipt(input: { sample?: boolean; today: string }): ReceiptExtraction {
  if (input.sample) {
    return {
      sample: true,
      message: 'Sample receipt read on device. Confirm it before saving.',
      expense: SAMPLE,
    };
  }
  return {
    sample: false,
    message: 'Photo saved on this device. The mock scan could not read a total — add the amount.',
    expense: {
      occurredOn: input.today,
      currency: 'INR',
      type: 'expense',
      categoryId: 'other',
      confidence: 0.2,
    },
  };
}
