import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Field, IconButton, Segmented , PressableScale, useToast } from '@/components/primitives';
import { EXPENSE_CATEGORIES } from '@/domain/categories';
import { todayISO } from '@/domain/dates';
import { createId, nowIso } from '@/domain/ids';
import { formatMoney, parseAmountText } from '@/domain/money';
import { advanceDate } from '@/domain/recurringDates';
import type { Cadence, TransactionType } from '@/domain/types';
import { useLedger } from '@/data/store';
import { useTheme } from '@/design/theme';

export default function RecurringFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ledger = useLedger();
  const { theme } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const existing = ledger.snapshot.recurring.find((rule) => rule.id === id && !rule.deletedAt);
  const home = ledger.snapshot.settings.homeCurrency;
  const [type, setType] = useState<TransactionType>(existing?.type ?? 'expense');
  const [amount, setAmount] = useState(existing ? String(existing.amountMinor / 100) : '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? 'subscriptions');
  const [note, setNote] = useState(existing?.note ?? '');
  const [merchant, setMerchant] = useState(existing?.merchant ?? '');
  const [cadence, setCadence] = useState<Cadence>(existing?.cadence ?? 'monthly');
  const [start, setStart] = useState(existing?.startDate ?? todayISO());

  const save = async () => {
    const amountMinor = parseAmountText(amount, home);
    if (!amountMinor) {
      toast.show({ title: 'Add an amount', tone: 'warn' });
      return;
    }
    const stamp = nowIso();
    await ledger.saveRecurring({
      id: existing?.id ?? createId(),
      type,
      amountMinor,
      currency: home,
      categoryId: type === 'income' ? 'income' : categoryId,
      note: note.trim(),
      merchant: merchant.trim(),
      cadence,
      intervalCount: 1,
      startDate: start,
      nextDate: start >= todayISO() ? start : advanceDate(start, cadence, 1),
      paused: existing?.paused ?? false,
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
      deletedAt: null,
    });
    toast.show({ title: 'Repeat saved', body: formatMoney(amountMinor, home), tone: 'good' });
    router.back();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
        <AppText variant="title">{existing ? 'Edit repeat' : 'New repeat'}</AppText>
      </View>
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { id: 'expense', label: 'Expense' },
          { id: 'income', label: 'Income' },
        ]}
      />
      <Field label={`Amount in ${home}`} value={amount} onChangeText={setAmount} placeholder="649" />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Netflix" />
      <Field label="Merchant" value={merchant} onChangeText={setMerchant} />
      <Field label="First date" value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" />
      <Segmented
        value={cadence}
        onChange={setCadence}
        options={[
          { id: 'weekly', label: 'Weekly' },
          { id: 'monthly', label: 'Monthly' },
          { id: 'yearly', label: 'Yearly' },
        ]}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {EXPENSE_CATEGORIES.map((category) => (
          <PressableScale
            key={category.id}
            onPress={() => setCategoryId(category.id)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: categoryId === category.id ? theme.accent : theme.line,
              backgroundColor: categoryId === category.id ? theme.accentSoft : theme.card,
            }}>
            <AppText variant="heading" style={{ fontSize: 13 }}>{category.name}</AppText>
          </PressableScale>
        ))}
      </View>
      <Button label="Save repeat" onPress={() => void save()} />
    </ScrollView>
  );
}
