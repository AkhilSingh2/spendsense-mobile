import { useMemo, useState } from 'react';
import { Alert, Image as RNImage, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EXPENSE_CATEGORIES, categoryById } from '@/domain/categories';
import { addDays, formatDayLabel, todayISO } from '@/domain/dates';
import { createId, nowIso } from '@/domain/ids';
import { CURRENCY_LIST, exponentOf, formatMoney, parseAmountText } from '@/domain/money';
import { advanceDate } from '@/domain/recurringDates';
import type { Cadence, EntrySource, RecurringRule, Transaction, TransactionType } from '@/domain/types';
import { useLedger } from '@/data/store';
import { useTheme } from '@/design/theme';
import { font } from '@/design/tokens';
import { AppText, Button, Field, IconButton, Keypad, PressableScale, Segmented, useToast } from '@/components/primitives';
import { CategoryGlyph } from '@/components/expense';
import { parseExpense, type ParseOutcome } from '@/parse/llm';
import { extractReceipt } from '@/parse/receipt';

const SAMPLE = require('../../assets/images/sample-receipt.png');

type Mode = 'amount' | 'words' | 'receipt';

function pushKey(current: string, key: string, currency: string): string {
  if (key === 'back') return current.slice(0, -1);
  const exponent = exponentOf(currency);
  if (key === '.') {
    if (exponent === 0 || current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  const next = current === '0' ? key : `${current}${key}`;
  const fraction = next.split('.')[1] ?? '';
  if (fraction.length > exponent) return current;
  if (next.replace('.', '').length > 9) return current;
  return next;
}

function minorToText(minor: number, currency: string): string {
  const factor = 10 ** exponentOf(currency);
  const major = minor / factor;
  return Number.isInteger(major) ? String(major) : String(major);
}

export function ExpenseEditor({
  existing,
  initialMode = 'amount',
  onClose,
}: {
  existing?: Transaction | null;
  initialMode?: Mode;
  onClose: () => void;
}) {
  const ledger = useLedger();
  const { theme, fontsReady, reduceMotion } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const today = todayISO();
  const home = ledger.snapshot.settings.homeCurrency;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [type, setType] = useState<TransactionType>(existing?.type ?? 'expense');
  const [amountText, setAmountText] = useState(existing ? minorToText(existing.amountMinor, existing.currency) : '');
  const [currency, setCurrency] = useState(existing?.currency ?? home);
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? 'food');
  const [note, setNote] = useState(existing?.note ?? '');
  const [merchant, setMerchant] = useState(existing?.merchant ?? '');
  const [occurredOn, setOccurredOn] = useState(existing?.occurredOn ?? today);
  const [receiptUri, setReceiptUri] = useState<string | null>(existing?.receiptUri ?? null);
  const [source, setSource] = useState<EntrySource>(existing?.source ?? 'manual');
  const [words, setWords] = useState('');
  const [parsing, setParsing] = useState(false);
  const [outcome, setOutcome] = useState<ParseOutcome | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [receiptMessage, setReceiptMessage] = useState('');

  const days = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(today, -index)), [today]);
  const categories = type === 'income' ? [categoryById('income')] : EXPENSE_CATEGORIES;

  const applyParsed = (parsed: ParseOutcome) => {
    if (!parsed.ok) return;
    setType(parsed.expense.type);
    setAmountText(minorToText(parsed.expense.amountMinor, parsed.expense.currency));
    setCurrency(parsed.expense.currency);
    setCategoryId(parsed.expense.categoryId);
    setNote(parsed.expense.note);
    setMerchant(parsed.expense.merchant);
    setOccurredOn(parsed.expense.occurredOn);
    setCadence(parsed.expense.cadence ?? 'monthly');
    setRepeat(Boolean(parsed.expense.cadence));
    setSource('words');
  };

  const understand = async () => {
    setParsing(true);
    const started = Date.now();
    const client =
      ledger.snapshot.settings.parserMode === 'rules'
        ? { parse: async () => Promise.reject(new Error('rules')) }
        : undefined;
    const result = await parseExpense(
      words,
      { today, homeCurrency: home },
      client,
    );
    if (!reduceMotion) {
      const wait = Math.max(0, 420 - (Date.now() - started));
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    setOutcome(result);
    if (result.ok) applyParsed(result);
    setParsing(false);
  };

  const capturePhoto = async (camera: boolean) => {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.show({ title: 'Camera permission is off', body: 'You can still try the sample receipt.', tone: 'warn' });
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri ?? null;
    setReceiptUri(uri);
    setReceiptMessage(extractReceipt({ today }).message);
    setSource('receipt');
  };

  const useSample = () => {
    const resolved = RNImage.resolveAssetSource(SAMPLE)?.uri;
    if (!resolved) return;
    const extraction = extractReceipt({ sample: true, today });
    setReceiptUri(resolved);
    setReceiptMessage(extraction.message);
    if (extraction.expense.amountMinor && extraction.expense.currency && extraction.expense.occurredOn) {
      setAmountText(minorToText(extraction.expense.amountMinor, extraction.expense.currency));
      setCurrency(extraction.expense.currency);
      setCategoryId(extraction.expense.categoryId ?? 'food');
      setNote(extraction.expense.note ?? '');
      setMerchant(extraction.expense.merchant ?? '');
      setOccurredOn(extraction.expense.occurredOn);
      setType('expense');
    }
    setSource('receipt');
  };

  const save = async () => {
    const amountMinor = parseAmountText(amountText, currency);
    if (!amountMinor) {
      toast.show({ title: 'Add an amount', body: 'Use the keypad or a line like “450 lunch yesterday”.', tone: 'warn' });
      return;
    }
    const stamp = nowIso();
    const tx: Transaction = {
      id: existing?.id ?? createId(),
      type,
      amountMinor,
      currency,
      categoryId: type === 'income' ? 'income' : categoryId,
      note: note.trim(),
      merchant: merchant.trim(),
      occurredOn,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
      receiptUri,
      recurringId: existing?.recurringId ?? null,
      source: existing ? existing.source : source,
      deletedAt: null,
    };
    let rule: RecurringRule | null = null;
    if (repeat) {
      const ruleId = tx.recurringId ?? createId();
      tx.recurringId = ruleId;
      rule = {
        id: ruleId,
        type: tx.type,
        amountMinor: tx.amountMinor,
        currency: tx.currency,
        categoryId: tx.categoryId,
        note: tx.note,
        merchant: tx.merchant,
        cadence,
        intervalCount: 1,
        startDate: tx.occurredOn,
        nextDate: advanceDate(tx.occurredOn, cadence, 1),
        paused: false,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      };
    }
    await ledger.saveTransaction(tx, { recurring: rule });
    toast.show({
      title: existing ? 'Expense updated' : 'Expense saved',
      body: `${formatMoney(amountMinor, currency)} · ${categoryById(tx.categoryId).name}`,
      tone: 'good',
    });
    onClose();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Delete this expense?', 'It leaves the charts. A tombstone stays so sync can catch up.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void ledger.deleteTransaction(existing.id).then(onClose);
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <IconButton icon="close" label="Close" onPress={onClose} />
        <AppText variant="heading">{existing ? 'Edit expense' : 'Add expense'}</AppText>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: mode === 'amount' ? 280 : 40, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { id: 'amount', label: 'Amount' },
            { id: 'words', label: 'Words' },
            { id: 'receipt', label: 'Receipt' },
          ]}
        />
        <Segmented
          value={type}
          onChange={(next) => {
            setType(next);
            if (next === 'income') setCategoryId('income');
          }}
          options={[
            { id: 'expense', label: 'Expense' },
            { id: 'income', label: 'Income' },
          ]}
        />
        {mode === 'words' ? (
          <View style={{ gap: 12 }}>
            <Field
              label="In your own words"
              value={words}
              onChangeText={setWords}
              placeholder="450 lunch with team yesterday"
              multiline
              testID="words-input"
            />
            <Button label={parsing ? 'Reading…' : 'Understand'} onPress={() => void understand()} disabled={parsing || !words.trim()} testID="words-parse" />
            {outcome && !outcome.ok ? <AppText color={theme.danger}>{outcome.message}</AppText> : null}
            {outcome?.ok ? (
              <View style={{ padding: 14, borderRadius: 18, backgroundColor: theme.accentSoft, gap: 4 }}>
                <AppText variant="label">{outcome.source === 'llm' ? 'On-device AI' : 'Rules fallback'}</AppText>
                <AppText variant="heading">{outcome.expense.interpretation}</AppText>
              </View>
            ) : null}
          </View>
        ) : null}
        {mode === 'receipt' ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button label="Camera" tone="secondary" onPress={() => void capturePhoto(true)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Library" tone="secondary" onPress={() => void capturePhoto(false)} />
              </View>
            </View>
            <Button label="Try the sample receipt" tone="ghost" onPress={useSample} testID="sample-receipt" />
            {receiptUri ? (
              <Image source={{ uri: receiptUri }} style={{ width: '100%', height: 220, borderRadius: 18 }} contentFit="cover" accessibilityLabel="Receipt preview" />
            ) : null}
            {receiptMessage ? <AppText variant="muted">{receiptMessage}</AppText> : null}
          </View>
        ) : null}
        <View style={{ alignItems: 'center', gap: 4 }}>
          <AppText variant="label">{currency}</AppText>
          <AppText
            variant="display"
            style={{ fontFamily: fontsReady ? font.display : undefined }}
            accessibilityLabel={`Amount ${amountText || '0'} ${currency}`}>
            {amountText || '0'}
          </AppText>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CURRENCY_LIST.map((item) => (
            <PressableScale
              key={item.code}
              onPress={() => setCurrency(item.code)}
              accessibilityLabel={item.name}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: item.code === currency ? theme.accent : theme.line,
                backgroundColor: item.code === currency ? theme.accentSoft : theme.card,
              }}>
              <AppText variant="heading" style={{ fontSize: 13 }}>
                {item.code}
              </AppText>
            </PressableScale>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {categories.map((category) => {
            const selected = category.id === categoryId;
            return (
              <PressableScale
                key={category.id}
                onPress={() => setCategoryId(category.id)}
                accessibilityLabel={category.name}
                style={{
                  width: '22%',
                  flexGrow: 1,
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 8,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: selected ? theme.accent : theme.line,
                  backgroundColor: selected ? theme.accentSoft : theme.card,
                }}>
                <CategoryGlyph categoryId={category.id} size={36} />
                <AppText variant="muted" style={{ fontSize: 11, textAlign: 'center' }}>
                  {category.name}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
        <Field label="Note" value={note} onChangeText={setNote} placeholder="Lunch with team" />
        <Field label="Merchant" value={merchant} onChangeText={setMerchant} placeholder="Optional" />
        <View style={{ gap: 8 }}>
          <AppText variant="label">Date</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((day) => {
              const selected = day === occurredOn;
              return (
                <PressableScale
                  key={day}
                  onPress={() => setOccurredOn(day)}
                  accessibilityLabel={formatDayLabel(day, today)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: selected ? theme.accent : theme.line,
                    backgroundColor: selected ? theme.accent : theme.card,
                  }}>
                  <AppText variant="heading" style={{ fontSize: 13 }} color={selected ? theme.accentInk : theme.ink}>
                    {formatDayLabel(day, today)}
                  </AppText>
                </PressableScale>
              );
            })}
          </ScrollView>
          {!days.includes(occurredOn) ? <AppText variant="muted">Selected {formatDayLabel(occurredOn, today)}</AppText> : null}
        </View>
        <PressableScale
          accessibilityLabel={repeat ? 'Turn repeat off' : 'Turn repeat on'}
          onPress={() => setRepeat((value) => !value)}
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.line,
            padding: 14,
            backgroundColor: theme.card,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}>
          <AppText variant="heading">Repeat</AppText>
          <AppText color={theme.accent}>{repeat ? 'On' : 'Off'}</AppText>
        </PressableScale>
        {repeat ? (
          <Segmented
            value={cadence}
            onChange={setCadence}
            options={[
              { id: 'weekly', label: 'Weekly' },
              { id: 'monthly', label: 'Monthly' },
              { id: 'yearly', label: 'Yearly' },
            ]}
          />
        ) : null}
        <Button label={existing ? 'Save changes' : 'Save expense'} onPress={() => void save()} testID="save-expense" />
        {existing ? <Button label="Delete expense" tone="danger" onPress={remove} /> : null}
      </ScrollView>
      {mode === 'amount' ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: insets.bottom + 12, backgroundColor: theme.bg }}>
          <Keypad
            keys={['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back']}
            onKey={(key) => setAmountText((current) => pushKey(current, key, currency))}
          />
        </View>
      ) : null}
    </View>
  );
}
