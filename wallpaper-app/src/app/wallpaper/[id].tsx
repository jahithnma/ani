import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton, Icon } from '../../components/ui';
import { saveToGallery } from '../../lib/download';
import { useFavorites } from '../../lib/favorites';
import { usePremium } from '../../lib/premium';
import { getWallpaper, resolutionLabel } from '../../lib/wallpapers';
import { colors, gradients } from '../../theme';

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={styles.clock} pointerEvents="none">
      <Text style={styles.clockDate}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      <Text style={styles.clockTime}>{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</Text>
    </View>
  );
}

export default function WallpaperViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wallpaper = getWallpaper(id);
  const insets = useSafeAreaInsets();
  const { isPremium } = usePremium();
  const { isFavorite, toggle } = useFavorites();
  const [chrome, setChrome] = useState(true);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!wallpaper) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textDim }}>Wallpaper not found.</Text>
        <Pressable onPress={() => router.back()} style={{ padding: 16 }}>
          <Text style={{ color: colors.accent2 }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const locked = wallpaper.premium && !isPremium;
  const fav = isFavorite(wallpaper.id);

  const save = async () => {
    setSaving(true);
    try {
      await saveToGallery(wallpaper);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Saved ✓', 'Wallpaper saved to your gallery. Open Photos → Use as Wallpaper to apply it.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setChrome((c) => !c)}>
        <Image source={{ uri: wallpaper.thumb }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={locked ? 25 : 0} />
        {!locked ? (
          <Image
            source={{ uri: wallpaper.full }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
            priority="high"
            onLoad={() => setFullLoaded(true)}
          />
        ) : null}
      </Pressable>

      {!chrome && !locked ? <Clock /> : null}

      {chrome ? (
        <>
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.round}>
              <Icon name="close" size={18} />
            </Pressable>
            {!fullLoaded && !locked ? (
              <View style={styles.loadingPill}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingText}>Loading {resolutionLabel(wallpaper)}…</Text>
              </View>
            ) : (
              <Text style={styles.hint}>Tap image to preview</Text>
            )}
          </LinearGradient>

          <LinearGradient colors={gradients.fade} style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.title}>{wallpaper.title}</Text>
            <Text style={styles.meta}>
              {resolutionLabel(wallpaper)} · {wallpaper.width}×{wallpaper.height}
              {wallpaper.premium ? ' · ♛ Premium exclusive' : ''}
            </Text>
            {wallpaper.credit ? (
              <Text
                style={[styles.meta, wallpaper.creditUrl && { textDecorationLine: 'underline' }]}
                onPress={wallpaper.creditUrl ? () => Linking.openURL(wallpaper.creditUrl!) : undefined}
              >
                {wallpaper.credit}
              </Text>
            ) : null}

            {locked ? (
              <View style={{ marginTop: 16 }}>
                <BlurView intensity={30} tint="dark" style={styles.lockBox}>
                  <Text style={styles.lockText}>🔒 This 8K wallpaper is part of the Premium collection.</Text>
                </BlurView>
                <GradientButton variant="gold" title="Unlock with Premium ♛" onPress={() => router.push('/premium')} />
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable onPress={() => toggle(wallpaper)} style={[styles.round, styles.big]}>
                  <Icon name={fav ? 'heart' : 'heartOutline'} color={fav ? colors.danger : '#fff'} size={24} />
                </Pressable>
                <GradientButton title="Download" onPress={save} loading={saving} style={{ flex: 1 }} />
              </View>
            )}
          </LinearGradient>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 24 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  big: { width: 54, height: 54, borderRadius: 16 },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  loadingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  loadingText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 60 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  meta: { color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18, alignItems: 'center' },
  lockBox: { borderRadius: 14, overflow: 'hidden', padding: 14, marginBottom: 12 },
  lockText: { color: '#fff', fontWeight: '600' },
  clock: { position: 'absolute', top: 110, left: 0, right: 0, alignItems: 'center' },
  clockDate: { color: '#fff', fontSize: 18, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 6 },
  clockTime: { color: '#fff', fontSize: 86, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 10 },
});
