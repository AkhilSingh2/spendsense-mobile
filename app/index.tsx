import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/primitives';
import { useLedger } from '@/data/store';
import { useTheme } from '@/design/theme';

export default function Index() {
  const ledger = useLedger();
  const { theme } = useTheme();
  if (!ledger.ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: theme.bg }}>
        <AppText variant="title">SpendSense</AppText>
        <ActivityIndicator color={theme.accent} />
        <AppText variant="muted">Opening your ledger</AppText>
      </View>
    );
  }
  if (!ledger.snapshot.settings.onboardingComplete) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
