import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Keypad } from '@/components/primitives';
import { useTheme } from '@/design/theme';
import { useLedger } from '@/data/store';
import { authenticateBiometric, canUseBiometrics } from '@/services/biometrics';

export function LockScreen() {
  const { theme } = useTheme();
  const ledger = useLedger();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [biometric, setBiometric] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let active = true;
    if (!ledger.snapshot.settings.biometricEnabled) return undefined;
    canUseBiometrics()
      .then(async (available) => {
        if (!active) return;
        setBiometric(available);
        if (!available) return;
        const ok = await authenticateBiometric();
        if (ok && active) ledger.unlock();
      })
      .catch(() => setBiometric(false));
    return () => {
      active = false;
    };
    // Prompt once when the lock screen appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (next: string) => {
    if (Date.now() < lockedUntil) {
      setError('Too many tries. Wait a moment.');
      return;
    }
    const ok = await ledger.verifyPin(next);
    if (ok) {
      setPin('');
      setError('');
      ledger.unlock();
      return;
    }
    const count = attempts + 1;
    setAttempts(count);
    setPin('');
    if (count >= 5) {
      setLockedUntil(Date.now() + 30_000);
      setAttempts(0);
      setError('Locked for 30 seconds.');
      return;
    }
    setError('That PIN does not match.');
  };

  const onKey = (key: string) => {
    if (key === 'back') {
      setPin((current) => current.slice(0, -1));
      return;
    }
    const next = `${pin}${key}`.slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  };

  return (
    <View
      accessibilityViewIsModal
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 40,
        backgroundColor: theme.bg,
        paddingHorizontal: 24,
        justifyContent: 'center',
        gap: 22,
      }}>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <AppText variant="label">SpendSense</AppText>
        <AppText variant="title" accessibilityRole="header">
          The ledger is locked
        </AppText>
        <AppText variant="muted" style={{ textAlign: 'center' }}>
          Enter the 4-digit PIN. The numbers stay on this device.
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: index < pin.length ? theme.accent : theme.line,
            }}
          />
        ))}
      </View>
      {error ? (
        <AppText variant="muted" style={{ textAlign: 'center', color: theme.danger }}>
          {error}
        </AppText>
      ) : null}
      <Keypad keys={['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']} onKey={onKey} />
      {biometric && ledger.snapshot.settings.biometricEnabled ? (
        <Button label="Use biometrics" tone="secondary" onPress={() => authenticateBiometric().then((ok) => ok && ledger.unlock())} />
      ) : null}
    </View>
  );
}
