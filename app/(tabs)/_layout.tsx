import { Redirect, Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';
import { useLedger } from '@/data/store';

export default function TabLayout() {
  const ledger = useLedger();
  if (ledger.ready && !ledger.snapshot.settings.onboardingComplete) return <Redirect href="/onboarding" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets' }} />
    </Tabs>
  );
}
