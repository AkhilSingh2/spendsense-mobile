import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Field, IconButton, Keypad, Segmented , useToast } from '@/components/primitives';
import { CURRENCY_LIST } from '@/domain/money';
import { RATE_LABEL } from '@/domain/rates';
import type { ParserMode, ThemePreference } from '@/domain/types';
import { useLedger } from '@/data/store';
import { useTheme } from '@/design/theme';
import { canUseBiometrics } from '@/services/biometrics';
import { publishAlert } from '@/services/notifications';

export default function SettingsScreen() {
  const ledger = useLedger();
  const { theme } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const settings = ledger.snapshot.settings;
  const [name, setName] = useState(settings.displayName);
  const [syncUrl, setSyncUrl] = useState(settings.syncUrl);
  const [syncToken, setSyncToken] = useState(settings.syncToken);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [stage, setStage] = useState<'idle' | 'enter' | 'confirm'>('idle');
  const [biometrics, setBiometrics] = useState(false);

  useEffect(() => {
    canUseBiometrics().then(setBiometrics).catch(() => setBiometrics(false));
  }, []);

  const onPinKey = (key: string) => {
    const current = stage === 'confirm' ? confirm : pin;
    const next = key === 'back' ? current.slice(0, -1) : `${current}${key}`.slice(0, 4);
    if (stage === 'confirm') setConfirm(next);
    else setPin(next);
    if (next.length < 4 || key === 'back') return;
    if (stage === 'enter') {
      setStage('confirm');
      return;
    }
    if (next !== pin) {
      toast.show({ title: 'PINs did not match', tone: 'warn' });
      setConfirm('');
      setStage('enter');
      setPin('');
      return;
    }
    void ledger.setPin(next).then(() => {
      ledger.unlock();
      setStage('idle');
      setPin('');
      setConfirm('');
      toast.show({ title: 'PIN saved', tone: 'good' });
    });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 48, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton icon="arrow-left" label="Back" onPress={() => router.back()} />
        <AppText variant="title" accessibilityRole="header">Settings</AppText>
      </View>
      <Field label="Name" value={name} onChangeText={setName} />
      <Button label="Save name" tone="secondary" onPress={() => void ledger.updateSettings({ displayName: name.trim() || 'Akhilendra' })} />
      <AppText variant="label">Home currency</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CURRENCY_LIST.map((item) => (
          <Button
            key={item.code}
            label={item.code}
            tone={settings.homeCurrency === item.code ? 'primary' : 'secondary'}
            onPress={() => void ledger.updateSettings({ homeCurrency: item.code })}
          />
        ))}
      </View>
      <AppText variant="muted">{RATE_LABEL}.</AppText>
      <AppText variant="label">Appearance</AppText>
      <Segmented<ThemePreference>
        value={settings.theme}
        onChange={(themePreference) => void ledger.updateSettings({ theme: themePreference })}
        options={[
          { id: 'system', label: 'System' },
          { id: 'light', label: 'Light' },
          { id: 'dark', label: 'Dark' },
        ]}
      />
      <AppText variant="label">Parser</AppText>
      <Segmented<ParserMode>
        value={settings.parserMode}
        onChange={(parserMode) => void ledger.updateSettings({ parserMode })}
        options={[
          { id: 'ai', label: 'On-device AI' },
          { id: 'rules', label: 'Rules only' },
        ]}
      />
      <AppText variant="muted">
        Rules need digits, as in “450 lunch yesterday”. The on-device model also reads “four hundred fifty”. A real model is used only if you set an API key.
      </AppText>
      <Row label="Budget alerts">
        <Switch
          value={settings.notificationsEnabled}
          onValueChange={(notificationsEnabled) => void ledger.updateSettings({ notificationsEnabled })}
          accessibilityLabel="Budget alerts"
        />
      </Row>
      <Button
        label="Send a test alert"
        tone="secondary"
        onPress={() => void publishAlert({ title: 'SpendSense test', body: 'Budget alerts will look like this.', tone: 'info' }, settings.notificationsEnabled)}
      />
      <AppText variant="label">Lock</AppText>
      <Row label="Require a PIN">
        <Switch
          value={settings.lockEnabled}
          onValueChange={(lockEnabled) => {
            if (lockEnabled && !settings.pinHash) {
              setStage('enter');
              return;
            }
            void ledger.updateSettings({ lockEnabled });
            if (lockEnabled) ledger.lockNow();
          }}
          accessibilityLabel="Require a PIN"
        />
      </Row>
      {biometrics ? (
        <Row label="Biometrics">
          <Switch
            value={settings.biometricEnabled}
            onValueChange={(biometricEnabled) => void ledger.updateSettings({ biometricEnabled })}
            accessibilityLabel="Unlock with biometrics"
          />
        </Row>
      ) : (
        <AppText variant="muted">
          Face ID inside Expo Go on iOS is not available. Fingerprint works on many Android devices, and the PIN works everywhere, including web.
        </AppText>
      )}
      {stage !== 'idle' ? (
        <View style={{ gap: 10 }}>
          <AppText variant="heading">{stage === 'enter' ? 'Choose a 4-digit PIN' : 'Repeat the PIN'}</AppText>
          <Keypad keys={['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']} onKey={onPinKey} />
        </View>
      ) : (
        <Button label="Change PIN" tone="secondary" onPress={() => setStage('enter')} />
      )}
      <AppText variant="label">Sync</AppText>
      <AppText variant="muted">Driver: {ledger.driver === 'sqlite' ? 'SQLite' : ledger.driver === 'local' ? 'Browser storage' : 'Starting'}. Last sync: {settings.lastSyncedAt ?? 'never'}.</AppText>
      <Field label="Sync URL" value={syncUrl} onChangeText={setSyncUrl} placeholder="http://localhost:8787" />
      <Field label="Sync token" value={syncToken} onChangeText={setSyncToken} placeholder="Optional" />
      <Button
        label="Save sync settings"
        tone="secondary"
        onPress={() => void ledger.updateSettings({ syncUrl: syncUrl.trim(), syncToken: syncToken.trim() })}
      />
      <Button label="Sync now" onPress={() => void ledger.syncNow().then((message) => toast.show({ title: message }))} />
      <AppText variant="label">Data</AppText>
      <Button label="Export CSV" tone="secondary" onPress={() => void ledger.exportCsv().catch((error: Error) => toast.show({ title: 'Export failed', body: error.message, tone: 'warn' }))} />
      <Button
        label="Reload sample month"
        tone="secondary"
        onPress={() =>
          Alert.alert('Replace the ledger with the sample month?', 'Your current lines will be overwritten on this device.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Load sample', onPress: () => void ledger.loadSample() },
          ])
        }
      />
      <Button
        label="Erase expenses"
        tone="danger"
        onPress={() =>
          Alert.alert('Erase the ledger?', 'Profile, theme, and PIN stay. Expenses, budgets, and repeats go.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Erase', style: 'destructive', onPress: () => void ledger.eraseData() },
          ])
        }
      />
      <Button label="Replay intro" tone="ghost" onPress={() => router.push('/onboarding')} />
      <View style={{ gap: 6, paddingTop: 8 }}>
        <AppText variant="heading">Built by Akhilendra Singh</AppText>
        <AppText variant="muted">A portfolio piece for local-first product engineering. github.com/AkhilSingh2</AppText>
        <Button label="Open GitHub" tone="secondary" onPress={() => void Linking.openURL('https://github.com/AkhilSingh2')} />
      </View>
    </ScrollView>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
      <AppText variant="heading">{label}</AppText>
      {children}
    </View>
  );
}
