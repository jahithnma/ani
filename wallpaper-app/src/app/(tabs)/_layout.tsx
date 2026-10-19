import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '../../components/ui';
import { colors } from '../../theme';

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color }: { color: ColorValue }) => <Icon name={icon} color={color} size={22} />,
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent2,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={tab('Home', 'home')} />
      <Tabs.Screen name="search" options={tab('Search', 'search')} />
      <Tabs.Screen name="studio" options={tab('AI Studio', 'ai')} />
      <Tabs.Screen name="premium" options={{ ...tab('Premium', 'crown'), tabBarActiveTintColor: colors.gold }} />
      <Tabs.Screen name="favorites" options={tab('Saved', 'heart')} />
    </Tabs>
  );
}
