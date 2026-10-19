import { FlatList } from 'react-native';

import type { Wallpaper } from '../lib/wallpapers';
import { WallpaperCard } from './WallpaperCard';

export function HorizontalShelf({ data, cardWidth = 140 }: { data: Wallpaper[]; cardWidth?: number }) {
  return (
    <FlatList
      horizontal
      data={data}
      keyExtractor={(w) => w.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      renderItem={({ item }) => <WallpaperCard wallpaper={item} width={cardWidth} />}
    />
  );
}
