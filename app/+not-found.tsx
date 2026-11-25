import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/primitives';
import { useTheme } from '@/design/theme';

export default function NotFoundScreen() {
  const { theme } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Missing' }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: theme.bg, gap: 12 }}>
        <AppText variant="title">That screen is not on the ledger.</AppText>
        <Link href="/" style={{ color: theme.accent }}>
          <AppText color={theme.accent}>Back home</AppText>
        </Link>
      </View>
    </>
  );
}
