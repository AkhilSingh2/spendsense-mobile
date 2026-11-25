import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { font, radius } from '@/design/tokens';
import { useTheme } from '@/design/theme';
import { subscribeNotices, type AlertNotice } from '@/services/notices';
import { tap } from '@/services/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'muted';

export function AppText({
  variant = 'body',
  color,
  style,
  children,
  accessibilityRole,
  accessibilityLabel,
}: {
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  accessibilityRole?: 'header' | 'text' | 'summary';
  accessibilityLabel?: string;
}) {
  const { theme, fontsReady } = useTheme();
  const family = fontsReady
    ? {
        display: font.display,
        title: font.displaySoft,
        heading: font.semibold,
        body: font.body,
        label: font.semibold,
        muted: font.body,
      }[variant]
    : undefined;
  return (
    <RNText
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      maxFontSizeMultiplier={variant === 'display' ? 1.35 : 1.6}
      style={[
        styles[variant],
        { color: color ?? (variant === 'muted' || variant === 'label' ? theme.muted : theme.ink), fontFamily: family },
        style,
      ]}>
      {children}
    </RNText>
  );
}

export function PressableScale({
  onPress,
  disabled,
  style,
  children,
  accessibilityLabel,
  testID,
}: {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const { reduceMotion } = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress?.();
      }}
      onPressIn={() => {
        if (!reduceMotion) {
          // Reanimated shared values are designed to be written.
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withSpring(0.97, { damping: 18, stiffness: 280 });
        }
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withSpring(1, { damping: 18, stiffness: 280 });
      }}
      style={[animated, style, disabled ? { opacity: 0.45 } : null]}>
      {children}
    </AnimatedPressable>
  );
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  testID,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  testID?: string;
}) {
  const { theme } = useTheme();
  const background =
    tone === 'primary' ? theme.accent : tone === 'danger' ? theme.dangerSoft : tone === 'ghost' ? 'transparent' : theme.card;
  const color = tone === 'primary' ? theme.accentInk : tone === 'danger' ? theme.danger : theme.ink;
  const border = tone === 'secondary' ? theme.line : 'transparent';
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { backgroundColor: background, borderColor: border }]}>
      <AppText variant="heading" color={color} style={styles.buttonLabel}>
        {label}
      </AppText>
    </PressableScale>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress?: () => void;
  testID?: string;
}) {
  const { theme } = useTheme();
  return (
    <PressableScale
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.iconButton, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <MaterialCommunityIcons name={icon} size={22} color={theme.ink} />
    </PressableScale>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }, style]}>{children}</View>
  );
}

export function Screen({
  children,
  footer,
  scroll = false,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, paddingBottom: scroll ? 0 : insets.bottom }}>{children}</View>
      {footer ? (
        <View style={{ paddingBottom: insets.bottom + 12, paddingHorizontal: 20, backgroundColor: theme.bg }}>{footer}</View>
      ) : null}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  testID?: string;
}) {
  const { theme, fontsReady } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.faint}
        multiline={multiline}
        accessibilityLabel={label}
        style={[
          styles.input,
          {
            color: theme.ink,
            backgroundColor: theme.input,
            borderColor: theme.line,
            fontFamily: fontsReady ? font.medium : undefined,
            minHeight: multiline ? 96 : 52,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: theme.input, borderColor: theme.line }]}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={[styles.segmentItem, selected ? { backgroundColor: theme.card } : null]}>
            <AppText variant="heading" style={{ fontSize: 14 }} color={selected ? theme.ink : theme.muted}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Keypad({ keys, onKey }: { keys: string[]; onKey: (key: string) => void }) {
  const { theme } = useTheme();
  return (
    <View style={styles.keypad}>
      {keys.map((key) => (
        <Pressable
          key={key || 'blank'}
          accessibilityRole="button"
          accessibilityLabel={key === 'back' ? 'Delete digit' : key === '.' ? 'Decimal point' : key || 'Empty'}
          disabled={!key}
          onPress={() => key && onKey(key)}
          style={[styles.key, { backgroundColor: key ? theme.card : 'transparent', borderColor: key ? theme.line : 'transparent' }]}>
          {key === 'back' ? (
            <MaterialCommunityIcons name="backspace-outline" size={22} color={theme.ink} />
          ) : (
            <AppText variant="heading">{key}</AppText>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const ToastContext = createContext<{ show: (notice: AlertNotice) => void } | null>(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<AlertNotice | null>(null);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => subscribeNotices(setNotice), []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3600);
    return () => clearTimeout(timer);
  }, [notice]);
  const tone = notice?.tone === 'warn' ? theme.warnSoft : notice?.tone === 'good' ? theme.accentSoft : theme.card;
  return (
    <ToastContext.Provider value={{ show: setNotice }}>
      {children}
      {notice ? (
        <View
          accessibilityRole="alert"
          style={[styles.toast, { backgroundColor: tone, borderColor: theme.line, bottom: insets.bottom + 28 }]}>
          <AppText variant="heading">{notice.title}</AppText>
          {notice.body ? <AppText variant="muted">{notice.body}</AppText> : null}
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  display: { fontSize: 40, lineHeight: 46 },
  title: { fontSize: 30, lineHeight: 36 },
  heading: { fontSize: 16, lineHeight: 22 },
  body: { fontSize: 16, lineHeight: 22 },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' },
  muted: { fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  buttonLabel: { fontSize: 16 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  segment: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  key: {
    width: '30%',
    flexGrow: 1,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 4,
    zIndex: 30,
  },
});
