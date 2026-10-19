import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WallpaperGrid } from '../../components/WallpaperGrid';
import { useFavorites } from '../../lib/favorites';
import { colors } from '../../theme';

export default function Favorites() {
  const { favorites } = useFavorites();
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.title}>Saved</Text>
      <WallpaperGrid
        data={favorites}
        columns={3}
        emptyText={'No favorites yet.\nTap ♡ on any wallpaper to keep it here.'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
});
