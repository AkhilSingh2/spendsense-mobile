import 'react-native-reanimated';

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';

import { DemoNote } from '@/components/DemoNote';
import { LockScreen } from '@/components/LockScreen';
import { ToastProvider } from '@/components/primitives';
import { LedgerProvider, useLedger } from '@/data/store';
import { ThemeProvider, useTheme } from '@/design/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => undefined);
  }, [error, loaded]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LedgerProvider>
        <Shell fontsReady={Boolean(loaded) && !error} />
      </LedgerProvider>
      <DemoNote />
    </GestureHandlerRootView>
  );
}

function Shell({ fontsReady }: { fontsReady: boolean }) {
  const ledger = useLedger();
  return (
    <ThemeProvider preference={ledger.snapshot.settings.theme} fontsReady={fontsReady}>
      <ToastProvider>
        <Frame>
          <Routes />
          {ledger.ready &&
          ledger.snapshot.settings.onboardingComplete &&
          ledger.snapshot.settings.lockEnabled &&
          ledger.snapshot.settings.pinHash &&
          !ledger.unlocked ? (
            <LockScreen />
          ) : null}
        </Frame>
      </ToastProvider>
    </ThemeProvider>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.frame, alignItems: 'center' }}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, width: '100%', maxWidth: 480, backgroundColor: theme.bg }}>{children}</View>
    </View>
  );
}

function Routes() {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="expense" options={{ presentation: 'modal' }} />
      <Stack.Screen name="recurring" />
    </Stack>
  );
}
