import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FavoritesProvider } from '../lib/favorites';
import { PremiumProvider } from '../lib/premium';
import { colors } from '../theme';

SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PremiumProvider>
        <FavoritesProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'fade_from_bottom',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="wallpaper/[id]" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
            <Stack.Screen name="category/[id]" />
          </Stack>
        </FavoritesProvider>
      </PremiumProvider>
    </SafeAreaProvider>
  );
}
