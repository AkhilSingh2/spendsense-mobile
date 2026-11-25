import { router, useLocalSearchParams } from 'expo-router';

import { ExpenseEditor } from '@/components/ExpenseEditor';

export default function NewExpenseScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === 'words' || params.mode === 'receipt' ? params.mode : 'amount';
  return <ExpenseEditor initialMode={mode} onClose={() => router.back()} />;
}
