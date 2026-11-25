const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  grand: 1000,
  lakh: 100000,
  lac: 100000,
};

function cleanToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z]/g, '');
}

function consumeNumber(tokens: string[], start: number): { value: number; next: number } | null {
  let index = start;
  let current = 0;
  let total = 0;
  let saw = false;

  while (index < tokens.length) {
    const raw = cleanToken(tokens[index] ?? '');
    if (!raw) break;
    if (raw === 'and') {
      if (!saw) break;
      index += 1;
      continue;
    }
    if (raw === 'a' || raw === 'an') {
      const next = cleanToken(tokens[index + 1] ?? '');
      if (!(next in SCALES)) break;
      current += 1;
      saw = true;
      index += 1;
      continue;
    }
    if (raw in ONES) {
      current += ONES[raw] ?? 0;
      saw = true;
      index += 1;
      continue;
    }
    if (raw in TENS) {
      current += TENS[raw] ?? 0;
      saw = true;
      index += 1;
      continue;
    }
    if (raw in SCALES) {
      const scale = SCALES[raw] ?? 1;
      if (scale === 100) {
        current = (current || 1) * 100;
      } else {
        total += (current || 1) * scale;
        current = 0;
      }
      saw = true;
      index += 1;
      continue;
    }
    break;
  }

  if (!saw || index === start) return null;
  return { value: total + current, next: index };
}

/** Turns "four hundred fifty" into "450". Digit amounts are left untouched. */
export function replaceSpokenNumbers(input: string): string {
  const spaced = input.replace(/-/g, ' ');
  const tokens = spaced.split(/\s+/).filter(Boolean);
  const output: string[] = [];
  let index = 0;
  while (index < tokens.length) {
    const consumed = consumeNumber(tokens, index);
    if (consumed && consumed.next > index) {
      output.push(String(consumed.value));
      index = consumed.next;
      continue;
    }
    output.push(tokens[index] ?? '');
    index += 1;
  }
  return output.join(' ');
}
