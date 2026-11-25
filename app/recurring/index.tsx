import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, IconButton } from '@/components/primitives';
import { cadenceLabel } from '@/domain/recurringDates';
import { formatLongDate } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { categoryById } from '@/domain/categories';
import { useLedger } from '@/data/store';
import { useTheme } from '@/design/theme';

export default function RecurringScreen() {
  const ledger = useLedger();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const rules = ledger.snapshot.recurring.filter((rule) => !rule.deletedAt);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon="arrow-left" label="Back" onPress={() => router.back()} />
        <AppText variant="title" accessibilityRole="header">Repeats</AppText>
      </View>
      <AppText variant="muted">Due repeats post themselves the next time you open SpendSense.</AppText>
      {rules.length === 0 ? <AppText variant="muted">Nothing repeats yet.</AppText> : null}
      {rules.map((rule) => (
        <View key={rule.id} style={{ backgroundColor: theme.card, borderRadius: 18, borderWidth: 1, borderColor: theme.line, padding: 14, gap: 6 }}>
          <AppText variant="heading">{rule.merchant || rule.note || categoryById(rule.categoryId).name}</AppText>
          <AppText variant="muted">
            {formatMoney(rule.amountMinor, rule.currency)} · {cadenceLabel(rule.cadence, rule.intervalCount)}
          </AppText>
          <AppText variant="muted">{rule.paused ? 'Paused' : `Next ${formatLongDate(rule.nextDate)}`}</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                label={rule.paused ? 'Resume' : 'Pause'}
                tone="secondary"
                onPress={() => void ledger.saveRecurring({ ...rule, paused: !rule.paused, updatedAt: new Date().toISOString() })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Delete" tone="danger" onPress={() => void ledger.deleteRecurring(rule.id)} />
            </View>
          </View>
        </View>
      ))}
      <Button label="Add a repeat" onPress={() => router.push('/recurring/new')} />
    </ScrollView>
  );
}
