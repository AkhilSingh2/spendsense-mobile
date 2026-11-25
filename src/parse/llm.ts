import { isCategoryId } from '@/domain/categories';
import { isCurrencyCode, toMinor } from '@/domain/money';
import { replaceSpokenNumbers } from '@/parse/numberWords';
import { parseWithRules, type ParseContext, type ParsedExpense } from '@/parse/rules';
import type { Cadence, TransactionType } from '@/domain/types';

export type ParseSource = 'llm' | 'rules';

export type ParseOutcome =
  | { ok: true; source: ParseSource; expense: ParsedExpense }
  | { ok: false; message: string };

export interface LlmClient {
  parse(text: string, ctx: ParseContext): Promise<ParsedExpense | null>;
}

export class MockLlmClient implements LlmClient {
  async parse(text: string, ctx: ParseContext): Promise<ParsedExpense | null> {
    const rewritten = replaceSpokenNumbers(text);
    const parsed = parseWithRules(rewritten, ctx);
    if (!parsed) return null;
    return {
      ...parsed,
      confidence: Math.min(0.98, parsed.confidence + 0.04),
    };
  }
}

type OpenAiOptions = {
  apiKey: string;
  model: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

export class OpenAiLlmClient implements LlmClient {
  constructor(private readonly options: OpenAiOptions) {}

  async parse(text: string, ctx: ParseContext): Promise<ParsedExpense | null> {
    const fetcher = this.options.fetchImpl ?? fetch;
    const today = ctx.today ?? new Date().toISOString().slice(0, 10);
    const response = await fetcher(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.options.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Extract one personal finance entry. Reply with JSON only: {"amount": number, "currency": "INR", "type": "expense"|"income", "categoryId": string, "note": string, "merchant": string, "date": "YYYY-MM-DD", "cadence": null|"daily"|"weekly"|"monthly"|"yearly"}. categoryId must be one of food, groceries, transport, housing, utilities, shopping, health, entertainment, subscriptions, travel, education, personal, income, other. amount is major units.',
          },
          {
            role: 'user',
            content: `Today is ${today}. Home currency is ${ctx.homeCurrency ?? 'INR'}. Text: ${text}`,
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Model request failed (${response.status})`);
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content ?? '';
    return coerceModelPayload(content, ctx);
  }
}

export function coerceModelPayload(content: string, ctx: ParseContext): ParsedExpense | null {
  const stripped = content.replace(/```json|```/g, '').trim();
  const payload = JSON.parse(stripped) as {
    amount?: number;
    currency?: string;
    type?: TransactionType;
    categoryId?: string;
    note?: string;
    merchant?: string;
    date?: string;
    cadence?: Cadence | null;
  };
  if (!payload.amount || payload.amount <= 0) return null;
  const currency = payload.currency && isCurrencyCode(payload.currency) ? payload.currency : ctx.homeCurrency ?? 'INR';
  const categoryId = payload.categoryId && isCategoryId(payload.categoryId) ? payload.categoryId : 'other';
  const occurredOn = payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date) ? payload.date : ctx.today ?? '';
  if (!occurredOn) return null;
  const type: TransactionType = payload.type === 'income' ? 'income' : 'expense';
  const note = (payload.note ?? '').trim();
  return {
    amountMinor: toMinor(payload.amount, currency),
    currency,
    type,
    categoryId: type === 'income' ? 'income' : categoryId,
    note,
    merchant: (payload.merchant ?? '').trim(),
    occurredOn,
    cadence: payload.cadence ?? null,
    confidence: 0.9,
    interpretation: `${payload.amount} ${currency} · ${type} · ${categoryId} · ${occurredOn} · ${note}`,
  };
}

export function clientFromEnv(env?: {
  mode?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): LlmClient {
  const mode = env?.mode ?? process.env.EXPO_PUBLIC_AI_MODE ?? 'mock';
  const apiKey = env?.apiKey ?? process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
  if (mode === 'openai' && apiKey) {
    return new OpenAiLlmClient({
      apiKey,
      model: env?.model ?? process.env.EXPO_PUBLIC_OPENAI_MODEL ?? 'gpt-4o-mini',
      baseUrl: env?.baseUrl ?? process.env.EXPO_PUBLIC_OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    });
  }
  return new MockLlmClient();
}

export async function parseExpense(
  text: string,
  ctx: ParseContext = {},
  client: LlmClient = clientFromEnv(),
): Promise<ParseOutcome> {
  try {
    const llm = await client.parse(text, ctx);
    if (llm && llm.amountMinor > 0) return { ok: true, source: 'llm', expense: llm };
  } catch {
    // The rule parser is the offline safety net.
  }
  const rules = parseWithRules(text, ctx);
  if (rules) return { ok: true, source: 'rules', expense: rules };
  return {
    ok: false,
    message: "Couldn't find an amount. Try “450 lunch with team yesterday”.",
  };
}
