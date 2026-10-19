import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryStrip } from '../../components/CategoryStrip';
import { HorizontalShelf } from '../../components/HorizontalShelf';
import { PremiumBanner } from '../../components/PremiumBanner';
import { SectionHeader } from '../../components/ui';
import { WallpaperGrid } from '../../components/WallpaperGrid';
import { FREE_EXCLUSIVES, PREMIUM_EXCLUSIVES, trendingPage, type Wallpaper } from '../../lib/wallpapers';
import { colors } from '../../theme';

export default function Home() {
  const [pages, setPages] = useState<Wallpaper[][]>(() => [trendingPage(0)]);
  const loadMore = useCallback(() => setPages((p) => (p.length < 30 ? [...p, trendingPage(p.length)] : p)), []);

  const header = (
    <View>
      <View style={styles.top}>
        <Text style={styles.brand}>
          Wallpaper <Text style={{ color: colors.accent2 }}>8K</Text>
        </Text>
        <Text style={styles.tagline}>AI-powered · Ultra HD · New every day</Text>
      </View>
      <PremiumBanner />
      <SectionHeader title="Categories" action="Search" onAction={() => router.push('/search')} />
      <CategoryStrip />
      <SectionHeader title="♛ Exclusive 8K" action="See all" onAction={() => router.push('/premium')} />
      <HorizontalShelf data={PREMIUM_EXCLUSIVES} />
      <SectionHeader title="Free 4K Originals" />
      <HorizontalShelf data={FREE_EXCLUSIVES} cardWidth={120} />
      <SectionHeader title="Trending AI" />
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <WallpaperGrid data={pages.flat()} header={header} onEndReached={loadMore} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  brand: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  tagline: { color: colors.textDim, marginTop: 2 },
});
