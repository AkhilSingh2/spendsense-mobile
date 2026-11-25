import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { categoryById } from '@/domain/categories';
import { useTheme } from '@/design/theme';
import { AppText } from '@/components/primitives';
import type { CategorySlice, DaySpend } from '@/domain/insights';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function Ring({
  progress,
  label,
  size = 96,
  track,
  color,
}: {
  progress: number;
  label: string;
  size?: number;
  track?: string;
  color?: string;
}) {
  const { theme, reduceMotion } = useTheme();
  const clamped = Math.max(0, Math.min(progress, 1));
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shared = useSharedValue(reduceMotion ? clamped : 0);
  useEffect(() => {
    shared.value = reduceMotion ? clamped : withTiming(clamped, { duration: 800 });
  }, [clamped, reduceMotion, shared]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - shared.value),
  }));
  return (
    <View accessibilityLabel={label} style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={track ?? theme.ringTrack}
            strokeWidth={stroke}
            fill="transparent"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color ?? theme.ring}
            strokeWidth={stroke}
            fill="transparent"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeLinecap="round"
            animatedProps={animatedProps}
          />
        </G>
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="heading" color={theme.heroText} style={{ fontSize: 13 }}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

export function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  const { theme, reduceMotion } = useTheme();
  const width = useSharedValue(reduceMotion ? Math.min(ratio, 1) : 0);
  useEffect(() => {
    const next = Math.max(0, Math.min(ratio, 1));
    width.value = reduceMotion ? next : withTiming(next, { duration: 700 });
  }, [ratio, reduceMotion, width]);
  const bar = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={{ height: 8, borderRadius: 99, backgroundColor: theme.input, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 8, borderRadius: 99, backgroundColor: color }, bar]} />
    </View>
  );
}

export function DayBars({ days, homeLabel }: { days: DaySpend[]; homeLabel: string }) {
  const { theme } = useTheme();
  const max = Math.max(...days.map((day) => day.amountMinor), 1);
  const summary = `Daily spending chart. Peak day is ${homeLabel}.`;
  return (
    <View accessibilityLabel={summary} style={{ height: 140, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
      {days.map((day) => (
        <DayBar key={day.date} amount={day.amountMinor} max={max} />
      ))}
      <AppText variant="muted" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
        {theme.scheme === 'dark' ? 'Dark chart' : 'Light chart'}
      </AppText>
    </View>
  );
}

function DayBar({ amount, max }: { amount: number; max: number }) {
  const { theme, reduceMotion } = useTheme();
  const target = amount === 0 ? 4 : Math.max(8, (amount / max) * 120);
  const height = useSharedValue(reduceMotion ? target : 4);
  useEffect(() => {
    height.value = reduceMotion ? target : withTiming(target, { duration: 650 });
  }, [height, reduceMotion, target]);
  const style = useAnimatedStyle(() => ({ height: height.value }));
  return (
    <Animated.View
      style={[
        {
          flex: 1,
          borderRadius: 4,
          backgroundColor: amount === 0 ? theme.line : theme.accent,
          opacity: amount === 0 ? 0.7 : 1,
        },
        style,
      ]}
    />
  );
}

export function Donut({ slices }: { slices: CategorySlice[] }) {
  const { theme } = useTheme();
  const total = slices.reduce((sum, slice) => sum + slice.amountMinor, 0);
  const size = 168;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const summary =
    slices.length === 0
      ? 'No category spending yet.'
      : slices
          .slice(0, 4)
          .map((slice) => `${categoryById(slice.categoryId).name} ${Math.round((slice.amountMinor / total) * 100)}%`)
          .join(', ');
  return (
    <View accessibilityLabel={`Spending by category. ${summary}`} style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.line} strokeWidth={stroke} fill="transparent" />
          {total > 0
            ? slices.map((slice) => {
                const length = (slice.amountMinor / total) * circumference;
                const dash = `${length} ${circumference - length}`;
                const rotation = (offset / total) * 360;
                offset += slice.amountMinor;
                return (
                  <Circle
                    key={slice.categoryId}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={categoryById(slice.categoryId).color}
                    strokeWidth={stroke}
                    fill="transparent"
                    strokeDasharray={dash}
                    transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                  />
                );
              })
            : null}
        </G>
      </Svg>
    </View>
  );
}
