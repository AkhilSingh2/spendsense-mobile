import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExpenseRow } from '@/components/expense';
import { AppText, PressableScale } from '@/components/primitives';
import { categoryById } from '@/domain/categories';
import { formatDayLabel, formatMonthLabel, monthKey, todayISO } from '@/domain/dates';
import { useLedger } from '@/data/store';
import { font } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import type { TransactionType } from '@/domain/types';

export default function ActivityScreen() {
  const ledger = useLedger();
  const { theme, fontsReady } = useTheme();
  const insets = useSafeAreaInsets();
  const today = todayISO();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | TransactionType>('all');
  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ledger.snapshot.transactions
      .filter((tx) => !tx.deletedAt)
      .filter((tx) => (filter === 'all' ? true : tx.type === filter))
      .filter((tx) => {
        if (!needle) return true;
        const category = categoryById(tx.categoryId).name.toLowerCase();
        return `${tx.note} ${tx.merchant} ${category}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt));
  }, [filter, ledger.snapshot.transactions, query]);

  const groups = new Map<string, typeof items>();
  for (const tx of items) {
    const list = groups.get(tx.occurredOn) ?? [];
    list.push(tx);
    groups.set(tx.occurredOn, list);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 140, gap: 14 }}>
      <AppText variant="title" accessibilityRole="header">Activity</AppText>
      <AppText variant="muted">{formatMonthLabel(monthKey(today))} and everything still on the ledger.</AppText>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search notes, merchants, categories"
        placeholderTextColor={theme.faint}
        accessibilityLabel="Search expenses"
        style={{ minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card, paddingHorizontal: 14, color: theme.ink, fontFamily: fontsReady ? font.medium : undefined }}
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['all', 'expense', 'income'] as const).map((id) => (
          <PressableScale
            key={id}
            onPress={() => setFilter(id)}
            accessibilityLabel={`Show ${id}`}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: filter === id ? theme.accent : theme.card,
              borderWidth: 1,
              borderColor: filter === id ? theme.accent : theme.line,
            }}>
            <AppText variant="heading" style={{ fontSize: 13 }} color={filter === id ? theme.accentInk : theme.ink}>
              {id === 'all' ? 'All' : id === 'expense' ? 'Expenses' : 'Income'}
            </AppText>
          </PressableScale>
        ))}
      </View>
      {[...groups.entries()].map(([date, rows]) => (
        <View key={date} style={{ gap: 8 }}>
          <AppText variant="label">{formatDayLabel(date, today)}</AppText>
          {rows.map((tx) => (
            <ExpenseRow
              key={tx.id}
              tx={tx}
              today={today}
              homeCurrency={ledger.snapshot.settings.homeCurrency}
              onPress={() => router.push(`/expense/${tx.id}`)}
              onDelete={() => void ledger.deleteTransaction(tx.id)}
            />
          ))}
        </View>
      ))}
      {items.length === 0 ? <AppText variant="muted">No lines match that filter.</AppText> : null}
    </ScrollView>
  );
}
