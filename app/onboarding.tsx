import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { AppText, Button, Field, PressableScale } from '@/components/primitives';
import { CURRENCY_LIST } from '@/domain/money';
import { useLedger } from '@/data/store';
import { useTheme } from '@/design/theme';
import { notificationPermission } from '@/services/notifications';

const ICON = require('../assets/images/icon.png');

export default function OnboardingScreen() {
  const ledger = useLedger();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(ledger.snapshot.settings.displayName);
  const [currency, setCurrency] = useState(ledger.snapshot.settings.homeCurrency);
  const [seed, setSeed] = useState(!ledger.snapshot.settings.seeded);
  const already = ledger.snapshot.settings.seeded;

  const finish = async () => {
    if (ledger.snapshot.settings.notificationsEnabled) await notificationPermission();
    await ledger.completeOnboarding({ name, currency, seed: seed && !already });
    router.replace('/');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingTop: insets.top + 28, paddingHorizontal: 24, paddingBottom: 40, gap: 22 }}>
      <Image source={ICON} style={{ width: 72, height: 72, borderRadius: 20 }} accessibilityLabel="SpendSense mark" />
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={{ width: 28, height: 4, borderRadius: 4, backgroundColor: index <= step ? theme.accent : theme.line }} />
        ))}
      </View>
      {step === 0 ? (
        <View style={{ gap: 12 }}>
          <AppText variant="label">SpendSense</AppText>
          <AppText variant="title" accessibilityRole="header">See the month clearly.</AppText>
          <AppText variant="body">
            Expenses, caps, and a short read on where the money went. The ledger stays on this device until you opt into sync.
          </AppText>
        </View>
      ) : null}
      {step === 1 ? (
        <View style={{ gap: 14 }}>
          <AppText variant="title" accessibilityRole="header">How should we count?</AppText>
          <Field label="Your name" value={name} onChangeText={setName} placeholder="Akhilendra" />
          <AppText variant="label">Home currency</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CURRENCY_LIST.map((item) => (
              <PressableScale
                key={item.code}
                onPress={() => setCurrency(item.code)}
                accessibilityLabel={item.name}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: currency === item.code ? theme.accent : theme.line,
                  backgroundColor: currency === item.code ? theme.accentSoft : theme.card,
                }}>
                <AppText variant="heading" style={{ fontSize: 14 }}>{item.code}</AppText>
              </PressableScale>
            ))}
          </View>
        </View>
      ) : null}
      {step === 2 ? (
        <View style={{ gap: 14 }}>
          <AppText variant="title" accessibilityRole="header">Start with a lived-in month?</AppText>
          <AppText variant="body">
            A sample Bengaluru month — rent, Swiggy, the metro — so the charts mean something before your own numbers replace them.
          </AppText>
          {already ? (
            <AppText variant="muted">Sample data is already on this device. Reset it later in settings.</AppText>
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="heading">Load the sample month</AppText>
              <Switch
                testID="sample-toggle"
                value={seed}
                onValueChange={setSeed}
                accessibilityLabel="Load the sample month"
                trackColor={{ true: theme.accent, false: theme.line }}
              />
            </View>
          )}
        </View>
      ) : null}
      {step < 2 ? (
        <Button testID="onboarding-next" label="Continue" onPress={() => setStep((value) => value + 1)} />
      ) : (
        <Button testID="onboarding-start" label="Enter SpendSense" onPress={() => void finish()} />
      )}
    </ScrollView>
  );
}
