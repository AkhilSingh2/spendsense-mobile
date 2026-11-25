import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/primitives';
import { useTheme } from '@/design/theme';
import { tap } from '@/services/haptics';

const ICONS = {
  index: 'home-variant-outline',
  activity: 'receipt-text-outline',
  insights: 'chart-donut',
  budgets: 'wallet-outline',
} as const;

type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  descriptors: Record<string, { options?: { title?: string } }>;
  emitter: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
  };
  navigateToTab: (routeKey: string) => void;
};

export function TabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 10),
        backgroundColor: theme.card,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: theme.line,
        flexDirection: 'row',
        padding: 6,
      }}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const options = descriptors[route.key]?.options;
        const label = options?.title ?? route.name;
        const icon = ICONS[route.name as keyof typeof ICONS] ?? 'circle-outline';
        const onPress = () => {
          tap();
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={onPress}
            style={{
              flex: 1,
              minHeight: 52,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: focused ? theme.accentSoft : 'transparent',
              gap: 2,
            }}>
            <MaterialCommunityIcons name={icon} size={20} color={focused ? theme.accent : theme.muted} />
            <AppText variant="muted" style={{ fontSize: 11 }} color={focused ? theme.accent : theme.muted}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
