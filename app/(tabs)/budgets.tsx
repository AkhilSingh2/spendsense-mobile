import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/charts';
import { CategoryGlyph } from '@/components/expense';
import { AppText, Button, Field, PressableScale , useToast } from '@/components/primitives';
import { budgetStatuses } from '@/domain/budgets';
import { EXPENSE_CATEGORIES } from '@/domain/categories';
import { monthKey, todayISO } from '@/domain/dates';
import { createId, nowIso } from '@/domain/ids';
import { formatMoney, parseAmountText } from '@/domain/money';
import { useLedger } from '@/data/store';
import { useTheme } from '@/design/theme';

export default function BudgetsScreen() {
  const ledger = useLedger();
  const { theme } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const home = ledger.snapshot.settings.homeCurrency;
  const month = monthKey(todayISO());
  const statuses = budgetStatuses(ledger.snapshot, month);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  const save = async () => {
    const amountMinor = parseAmountText(amount, home);
    if (!amountMinor) {
      toast.show({ title: 'Enter a cap', tone: 'warn' });
      return;
    }
    const existing = ledger.snapshot.budgets.find((budget) => !budget.deletedAt && budget.categoryId === categoryId);
    await ledger.saveBudget({
      id: existing?.id ?? createId(),
      categoryId,
      amountMinor,
      currency: home,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      deletedAt: null,
    });
    setAmount('');
    toast.show({ title: 'Budget saved', tone: 'good' });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 160, gap: 16 }}>
      <AppText variant="title" accessibilityRole="header">Budgets</AppText>
      <AppText variant="muted">Caps are in {home}. Crossing 75%, 90%, or 100% raises an alert.</AppText>
      {statuses.length === 0 ? <AppText variant="muted">No caps yet. The monthly one is the line on the home card.</AppText> : null}
      {statuses.map((status) => (
        <View key={status.budget.id} style={{ backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.line, padding: 14, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {status.budget.categoryId ? <CategoryGlyph categoryId={status.budget.categoryId} size={36} /> : null}
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{status.label}</AppText>
              <AppText variant="muted">
                {formatMoney(status.spentMinor, home)} of {formatMoney(status.budget.amountMinor, home)}
              </AppText>
            </View>
            <AppText color={status.level === 'over' ? theme.danger : theme.ink}>{Math.round(status.ratio * 100)}%</AppText>
          </View>
          <ProgressBar ratio={status.ratio} color={status.level === 'over' ? theme.danger : status.level === 'ok' ? theme.accent : theme.coral} />
          <Button label="Remove" tone="ghost" onPress={() => void ledger.deleteBudget(status.budget.id)} />
        </View>
      ))}
      <View style={{ gap: 10 }}>
        <AppText variant="label">New cap</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Choice label="Monthly" selected={categoryId === null} onPress={() => setCategoryId(null)} />
          {EXPENSE_CATEGORIES.map((category) => (
            <Choice key={category.id} label={category.name} selected={categoryId === category.id} onPress={() => setCategoryId(category.id)} />
          ))}
        </ScrollView>
        <Field label={`Amount in ${home}`} value={amount} onChangeText={setAmount} placeholder="8000" />
        <Button label="Save budget" onPress={() => void save()} />
      </View>
    </ScrollView>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? theme.accent : theme.line,
        backgroundColor: selected ? theme.accentSoft : theme.card,
      }}>
      <AppText variant="heading" style={{ fontSize: 13 }}>{label}</AppText>
    </PressableScale>
  );
}
