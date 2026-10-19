import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePremium } from '../lib/premium';
import { colors, radius } from '../theme';

export function PremiumBanner() {
  const { isPremium, price } = usePremium();
  if (isPremium) return null;
  return (
    <Pressable onPress={() => router.push('/premium')} style={{ marginHorizontal: 16, marginTop: 8 }}>
      <LinearGradient colors={['#3B0764', '#7C3AED', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>♛ LIFETIME PREMIUM</Text>
          <Text style={styles.title}>Unlock every exclusive 8K wallpaper</Text>
          <Text style={styles.sub}>One payment · {price} · yours forever</Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Get</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { color: colors.gold, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  title: { color: '#fff', fontWeight: '800', fontSize: 18, marginTop: 4 },
  sub: { color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  cta: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  ctaText: { color: '#3B0764', fontWeight: '800' },
});
