import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../../components/ui';
import { WallpaperGrid } from '../../components/WallpaperGrid';
import { categoryById } from '../../data/categories';
import { useFeed } from '../../lib/useFeed';
import { aiCategoryPage, exclusivesFor, interleave, searchPhotos } from '../../lib/wallpapers';
import { colors } from '../../theme';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = categoryById(id);

  const loadPage = useCallback(
    async (page: number) => {
      if (!category) return [];
      const ai = aiCategoryPage(category, page);
      const photos = await searchPhotos(category.query, page).catch(() => []);
      const mixed = interleave(ai, photos);
      return page === 0 ? [...exclusivesFor(category.id), ...mixed] : mixed;
    },
    [category],
  );
  const { items, loading, loadMore } = useFeed(loadPage);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Icon name="back" size={34} />
        </Pressable>
        <Text style={styles.title}>
          {category?.emoji} {category?.name ?? 'Category'}
        </Text>
      </View>
      <WallpaperGrid data={items} loading={loading} onEndReached={loadMore} emptyText="No wallpapers found." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  back: { width: 36, alignItems: 'center' },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
});
