import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { Wallpaper } from '../lib/wallpapers';
import { colors } from '../theme';
import { WallpaperCard } from './WallpaperCard';

const GAP = 10;
const PAD = 16;

export function useCardWidth(columns: number) {
  const { width } = useWindowDimensions();
  return Math.floor((Math.min(width, 900) - PAD * 2 - GAP * (columns - 1)) / columns);
}

export function WallpaperGrid({
  data,
  columns = 2,
  header,
  onEndReached,
  loading,
  emptyText,
}: {
  data: Wallpaper[];
  columns?: number;
  header?: ReactElement;
  onEndReached?: () => void;
  loading?: boolean;
  emptyText?: string;
}) {
  const cardWidth = useCardWidth(columns);
  return (
    <FlatList
      data={data}
      key={columns}
      numColumns={columns}
      keyExtractor={(w) => w.id}
      renderItem={({ item }) => <WallpaperCard wallpaper={item} width={cardWidth} />}
      columnWrapperStyle={columns > 1 ? { gap: GAP, paddingHorizontal: PAD } : undefined}
      contentContainerStyle={{ gap: GAP, paddingBottom: 40 }}
      ListHeaderComponent={header}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      showsVerticalScrollIndicator={false}
      ListFooterComponent={loading ? <ActivityIndicator color={colors.accent} style={{ margin: 24 }} /> : undefined}
      ListEmptyComponent={
        !loading && emptyText ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textDim, textAlign: 'center', fontSize: 15, lineHeight: 22 },
});
