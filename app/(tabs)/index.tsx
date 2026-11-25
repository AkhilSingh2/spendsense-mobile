import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ring } from '@/components/charts';
import { ExpenseRow } from '@/components/expense';
import { AppText, Button, IconButton, PressableScale , useToast } from '@/components/primitives';
import { budgetStatuses } from '@/domain/budgets';
import { categoryById } from '@/domain/categories';
import { formatDayLabel, formatMonthLabel, monthKey, todayISO } from '@/domain/dates';
import { buildInsights } from '@/domain/insights';
import { firstName, formatMoney } from '@/domain/money';
import { useLedger } from '@/data/store';
import { font } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { parseExpense } from '@/parse/llm';
import { createId, nowIso } from '@/domain/ids';
import type { Transaction } from '@/domain/types';

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const ledger = useLedger();
  const { theme, fontsReady, reduceMotion } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const today = todayISO();
  const month = monthKey(today);
  const settings = ledger.snapshot.settings;
  const insights = useMemo(() => buildInsights(ledger.snapshot, month, today), [ledger.snapshot, month, today]);
  const budgets = budgetStatuses(ledger.snapshot, month).slice(0, 3);
  const recent = ledger.snapshot.transactions
    .filter((tx) => !tx.deletedAt)
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const overall = budgetStatuses(ledger.snapshot, month).find((status) => status.budget.categoryId === null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof parseExpense>> | null>(null);

  const understand = async () => {
    setBusy(true);
    const started = Date.now();
    const client = settings.parserMode === 'rules' ? { parse: async () => Promise.reject(new Error('rules')) } : undefined;
    const result = await parseExpense(text, { today, homeCurrency: settings.homeCurrency }, client);
    if (!reduceMotion) await new Promise((resolve) => setTimeout(resolve, Math.max(0, 380 - (Date.now() - started))));
    setPreview(result);
    setBusy(false);
  };

  const savePreview = async () => {
    if (!preview || !preview.ok) return;
    const stamp = nowIso();
    const expense = preview.expense;
    const tx: Transaction = {
      id: createId(),
      type: expense.type,
      amountMinor: expense.amountMinor,
      currency: expense.currency,
      categoryId: expense.categoryId,
      note: expense.note,
      merchant: expense.merchant,
      occurredOn: expense.occurredOn,
      createdAt: stamp,
      updatedAt: stamp,
      receiptUri: null,
      recurringId: null,
      source: 'words',
      deletedAt: null,
    };
    await ledger.saveTransaction(tx);
    setText('');
    setPreview(null);
    toast.show({ title: 'Saved', body: `${formatMoney(tx.amountMinor, tx.currency)} · ${categoryById(tx.categoryId).name}`, tone: 'good' });
  };

  const ratio = overall ? overall.ratio : 0;
  const left = overall ? Math.max(overall.budget.amountMinor - overall.spentMinor, 0) : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 140, gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <AppText variant="label">{formatDayLabel(today, today)} · {formatMonthLabel(month)}</AppText>
          <AppText variant="title" accessibilityRole="header">
            {greeting(new Date())}, {firstName(settings.displayName)}
          </AppText>
        </View>
        <IconButton testID="open-settings" icon="cog-outline" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      <LinearGradient colors={[theme.heroStart, theme.heroEnd] as [string, string]} style={{ borderRadius: 28, padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <AppText variant="label" color={theme.heroMuted}>
              Spent in {formatMonthLabel(month).split(' ')[0]}
            </AppText>
            <AppText variant="display" color={theme.heroText} style={{ fontFamily: fontsReady ? font.display : undefined }}>
              {formatMoney(insights.spentMinor, settings.homeCurrency)}
            </AppText>
            <AppText variant="muted" color={theme.heroMuted}>
              {overall
                ? `of ${formatMoney(overall.budget.amountMinor, settings.homeCurrency)}`
                : 'No monthly cap yet'}
            </AppText>
          </View>
          {overall ? <Ring progress={ratio} label={`${Math.round(ratio * 100)}%`} /> : null}
        </View>
        <AppText variant="body" color={theme.heroText} style={{ marginTop: 16 }}>
          {overall
            ? `${formatMoney(left, settings.homeCurrency)} left · ${insights.daysLeft} days to go`
            : insights.sentences[0] ?? 'Add a budget when you want a line to stay under.'}
        </AppText>
      </LinearGradient>

      <View style={{ backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.line, paddingLeft: 16, flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          testID="quick-add-input"
          value={text}
          onChangeText={setText}
          placeholder="450 lunch with team yesterday"
          placeholderTextColor={theme.faint}
          accessibilityLabel="Describe an expense"
          onSubmitEditing={() => void understand()}
          style={{ flex: 1, minHeight: 56, color: theme.ink, fontFamily: fontsReady ? font.medium : undefined, fontSize: 16 }}
        />
        <IconButton testID="quick-add-submit" icon="arrow-up" label="Understand expense" onPress={() => void understand()} />
      </View>
      {busy ? <AppText variant="muted">Reading that line…</AppText> : null}
      {preview && !preview.ok ? <AppText color={theme.danger}>{preview.message}</AppText> : null}
      {preview?.ok ? (
        <View style={{ backgroundColor: theme.accentSoft, borderRadius: 18, padding: 14, gap: 10 }}>
          <AppText variant="label">{preview.source === 'llm' ? 'On-device AI' : 'Rules fallback'}</AppText>
          <AppText variant="heading">
            {formatMoney(preview.expense.amountMinor, preview.expense.currency)} · {categoryById(preview.expense.categoryId).name}
          </AppText>
          <AppText variant="muted">
            {preview.expense.note || 'No note'} · {formatDayLabel(preview.expense.occurredOn, today)}
          </AppText>
          <Button testID="quick-add-save" label="Save this" onPress={() => void savePreview()} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Action label="Amount" iconLabel="Add with keypad" testID="open-add" onPress={() => router.push('/expense/new')} />
        <Action label="Receipt" iconLabel="Add from a receipt" testID="open-receipt" onPress={() => router.push('/expense/new?mode=receipt')} />
        <Action label="Repeats" iconLabel="Recurring expenses" testID="open-recurring" onPress={() => router.push('/recurring')} />
      </View>

      <View style={{ gap: 8 }}>
        <AppText variant="label">Recent</AppText>
        {recent.length === 0 ? (
          <AppText variant="muted">Nothing here yet. The line above is the fastest way in.</AppText>
        ) : (
          recent.map((tx) => (
            <ExpenseRow
              key={tx.id}
              tx={tx}
              homeCurrency={settings.homeCurrency}
              today={today}
              onPress={() => router.push(`/expense/${tx.id}`)}
              onDelete={() => void ledger.deleteTransaction(tx.id)}
            />
          ))
        )}
      </View>

      {budgets.length > 0 ? (
        <View style={{ gap: 8 }}>
          <AppText variant="label">Budgets</AppText>
          {budgets.map((status) => (
            <View key={status.budget.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="heading">{status.label}</AppText>
                <AppText variant="muted">{Math.round(status.ratio * 100)}%</AppText>
              </View>
              <View style={{ height: 8, borderRadius: 99, backgroundColor: theme.input, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.min(status.ratio, 1) * 100}%`,
                    height: 8,
                    backgroundColor: status.level === 'over' ? theme.danger : status.level === 'ok' ? theme.accent : theme.coral,
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Action({ label, onPress, testID, iconLabel }: { label: string; onPress: () => void; testID: string; iconLabel: string }) {
  const { theme } = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={iconLabel}
      onPress={onPress}
      style={{ flex: 1, backgroundColor: theme.card, borderColor: theme.line, borderWidth: 1, borderRadius: 18, minHeight: 64, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="heading">{label}</AppText>
    </PressableScale>
  );
}
