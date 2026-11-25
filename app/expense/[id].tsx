import { router, useLocalSearchParams } from 'expo-router';

import { ExpenseEditor } from '@/components/ExpenseEditor';
import { AppText, Button } from '@/components/primitives';
import { useLedger } from '@/data/store';
import { useTheme } from '@/design/theme';
import { View } from 'react-native';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ledger = useLedger();
  const { theme } = useTheme();
  const existing = ledger.snapshot.transactions.find((tx) => tx.id === id && !tx.deletedAt) ?? null;
  if (!existing) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <AppText variant="title">That expense is gone</AppText>
        <Button label="Back" onPress={() => router.back()} />
      </View>
    );
  }
  return <ExpenseEditor existing={existing} onClose={() => router.back()} />;
}
