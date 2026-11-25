import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DayBars, Donut } from '@/components/charts';
import { CategoryGlyph } from '@/components/expense';
import { AppText, IconButton } from '@/components/primitives';
import { categoryById } from '@/domain/categories';
import { formatMonthLabel, monthKey, shiftMonth, todayISO } from '@/domain/dates';
import { buildInsights } from '@/domain/insights';
import { formatMoney } from '@/domain/money';
import { RATE_LABEL } from '@/domain/rates';
import { useLedger } from '@/data/store';
import { useTheme } from '@/design/theme';

export default function InsightsScreen() {
  const ledger = useLedger();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const today = todayISO();
  const [month, setMonth] = useState(monthKey(today));
  const insights = useMemo(() => buildInsights(ledger.snapshot, month, today), [ledger.snapshot, month, today]);
  const home = ledger.snapshot.settings.homeCurrency;
  const canGoForward = month < monthKey(today);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 140, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-left" label="Previous month" onPress={() => setMonth((current) => shiftMonth(current, -1))} />
        <AppText variant="title" accessibilityRole="header">{formatMonthLabel(month)}</AppText>
        <IconButton icon="chevron-right" label="Next month" onPress={() => canGoForward && setMonth((current) => shiftMonth(current, 1))} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat label="Spent" value={formatMoney(insights.spentMinor, home)} />
        <Stat label="Income" value={formatMoney(insights.incomeMinor, home)} />
      </View>
      <View style={{ gap: 10 }}>
        {insights.sentences.map((sentence) => (
          <View key={sentence} style={{ backgroundColor: theme.card, borderRadius: 18, borderWidth: 1, borderColor: theme.line, padding: 16 }}>
            <AppText variant="heading">{sentence}</AppText>
          </View>
        ))}
        {insights.sentences.length === 0 ? <AppText variant="muted">Add a few expenses and this page starts talking.</AppText> : null}
      </View>
      <View style={{ gap: 8 }}>
        <AppText variant="label">By day, outside rent</AppText>
        <DayBars days={insights.byDay} homeLabel={formatMoney(insights.spentMinor, home)} />
      </View>
      <View style={{ gap: 12, alignItems: 'center' }}>
        <AppText variant="label">By category</AppText>
        <Donut slices={insights.byCategory} />
        {insights.byCategory.map((slice) => (
          <View key={slice.categoryId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' }}>
            <CategoryGlyph categoryId={slice.categoryId} size={32} />
            <AppText variant="heading" style={{ flex: 1 }}>{categoryById(slice.categoryId).name}</AppText>
            <AppText variant="muted">{formatMoney(slice.amountMinor, home)}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="muted">{RATE_LABEL}. Foreign charges are converted into {home} for totals.</AppText>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.card, borderRadius: 18, borderWidth: 1, borderColor: theme.line, padding: 14, gap: 4 }}>
      <AppText variant="label">{label}</AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}
