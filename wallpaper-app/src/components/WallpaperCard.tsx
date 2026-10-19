import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePremium } from '../lib/premium';
import { resolutionLabel, type Wallpaper } from '../lib/wallpapers';
import { colors, radius } from '../theme';
import { Badge, Icon } from './ui';

export function WallpaperCard({ wallpaper, width }: { wallpaper: Wallpaper; width: number }) {
  const { isPremium } = usePremium();
  const locked = wallpaper.premium && !isPremium;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/wallpaper/[id]', params: { id: wallpaper.id } })}
      style={({ pressed }) => [styles.card, { width, height: width * 1.78, opacity: pressed ? 0.85 : 1 }]}
    >
      <Image
        source={{ uri: wallpaper.thumb }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={250}
        cachePolicy="memory-disk"
        recyclingKey={wallpaper.id}
        blurRadius={locked ? 6 : 0}
      />
      <View style={styles.badges}>
        {wallpaper.premium ? <Badge label="♛ PRO" tone="gold" /> : null}
        {wallpaper.source === 'ai' ? <Badge label="AI" /> : null}
        <Badge label={resolutionLabel(wallpaper)} />
      </View>
      {locked ? (
        <View style={styles.lock}>
          <Icon name="lock" size={22} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
  badges: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  lock: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
