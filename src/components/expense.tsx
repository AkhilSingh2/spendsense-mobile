import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { categoryById } from '@/domain/categories';
import { formatDayLabel } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { convertMinor } from '@/domain/rates';
import type { Transaction } from '@/domain/types';
import { useTheme } from '@/design/theme';
import { AppText, PressableScale } from '@/components/primitives';

export function CategoryGlyph({ categoryId, size = 40 }: { categoryId: string; size?: number }) {
  const category = categoryById(categoryId);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${category.color}22`,
      }}>
      <MaterialCommunityIcons
        name={category.icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={size * 0.46}
        color={category.color}
      />
    </View>
  );
}

export function ExpenseRow({
  tx,
  homeCurrency,
  today,
  onPress,
  onDelete,
}: {
  tx: Transaction;
  homeCurrency: string;
  today: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const translateX = useSharedValue(0);
  const pan = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-16, 16],
    onUpdate: (event) => {
      translateX.value = Math.min(0, Math.max(-96, event.translationX));
    },
    onFinalize: () => {
      translateX.value = withSpring(translateX.value < -48 ? -88 : 0, { damping: 18, stiffness: 220 });
    },
  });
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const category = categoryById(tx.categoryId);
  const homeMinor = convertMinor(tx.amountMinor, tx.currency, homeCurrency);
  const showOriginal = tx.currency !== homeCurrency;
  const sign = tx.type === 'income' ? '+' : '';
  return (
    <View style={{ marginBottom: 8 }}>
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 84,
          borderRadius: 18,
          backgroundColor: theme.dangerSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <PressableScale accessibilityLabel={`Delete ${tx.note || category.name}`} onPress={onDelete}>
          <MaterialCommunityIcons name="trash-can-outline" size={22} color={theme.danger} />
        </PressableScale>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={animated}>
          <PressableScale
            onPress={onPress}
            accessibilityLabel={`${tx.type === 'income' ? 'Income' : 'Expense'} ${tx.note || category.name}, ${formatMoney(tx.amountMinor, tx.currency)}`}
            style={{
              backgroundColor: theme.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: theme.line,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
            <CategoryGlyph categoryId={tx.categoryId} />
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{tx.merchant || tx.note || category.name}</AppText>
              <AppText variant="muted">
                {category.name} · {formatDayLabel(tx.occurredOn, today)}
              </AppText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="heading" color={tx.type === 'income' ? theme.accent : theme.ink}>
                {sign}
                {formatMoney(homeMinor, homeCurrency)}
              </AppText>
              {showOriginal ? <AppText variant="muted">{formatMoney(tx.amountMinor, tx.currency)}</AppText> : null}
            </View>
          </PressableScale>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
