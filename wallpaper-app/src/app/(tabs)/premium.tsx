import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton, SectionHeader } from '../../components/ui';
import { WallpaperCard } from '../../components/WallpaperCard';
import { useCardWidth } from '../../components/WallpaperGrid';
import { usePremium } from '../../lib/premium';
import { PREMIUM_EXCLUSIVES } from '../../lib/wallpapers';
import { colors, radius } from '../../theme';

const PERKS = [
  ['♛', 'Every exclusive 8K wallpaper', 'Original art made only for this app, never in the free section.'],
  ['✦', 'Unlimited AI Studio', 'Generate as many wallpapers as you want, in 2K.'],
  ['⤓', 'Full-resolution downloads', '7680px masters, crisp on every phone and tablet.'],
  ['∞', 'Pay once, keep forever', 'No subscription. New premium drops included.'],
];

export default function Premium() {
  const { isPremium, price, purchase, restore, storeAvailable, ready } = usePremium();
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const cardWidth = useCardWidth(3);
  const collage = PREMIUM_EXCLUSIVES.slice(0, 3);

  const run = async (kind: 'buy' | 'restore') => {
    setBusy(kind);
    const res = kind === 'buy' ? await purchase() : await restore();
    setBusy(null);
    if (res.ok) Alert.alert('Welcome to Premium ♛', 'All exclusive 8K wallpapers are now unlocked.');
    else if (res.message) Alert.alert(kind === 'buy' ? 'Purchase' : 'Restore', res.message);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={styles.hero}>
          <View style={styles.collage}>
            {collage.map((w, i) => (
              <Image
                key={w.id}
                source={{ uri: w.thumb }}
                style={[styles.collageImg, { transform: [{ rotate: `${(i - 1) * 8}deg` }, { translateY: i === 1 ? -12 : 6 }], zIndex: i === 1 ? 2 : 1 }]}
                contentFit="cover"
              />
            ))}
          </View>
          <LinearGradient colors={['transparent', colors.bg]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        </View>

        <Text style={styles.kicker}>LIFETIME PREMIUM</Text>
        <Text style={styles.title}>{isPremium ? 'You are Premium ♛' : 'Unlock the 8K collection'}</Text>

        <View style={styles.perks}>
          {PERKS.map(([icon, title, sub]) => (
            <View key={title} style={styles.perk}>
              <Text style={styles.perkIcon}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle}>{title}</Text>
                <Text style={styles.perkSub}>{sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {!isPremium ? (
          <View style={{ paddingHorizontal: 16 }}>
            <GradientButton
              variant="gold"
              title={`Buy Lifetime · ${price}`}
              onPress={() => run('buy')}
              loading={busy === 'buy'}
              disabled={!ready}
            />
            <Text style={styles.once}>One-time payment. No subscription.</Text>
            <Pressable onPress={() => run('restore')} disabled={busy !== null} style={{ alignSelf: 'center', padding: 12 }}>
              <Text style={styles.restore}>Restore purchase</Text>
            </Pressable>
            {ready && !storeAvailable ? (
              <Text style={styles.note}>In-app purchases are unavailable in this build. Install the app from Google Play or the App Store to buy Premium.</Text>
            ) : null}
          </View>
        ) : null}

        <SectionHeader title={`Exclusive collection · ${PREMIUM_EXCLUSIVES.length}`} />
        <View style={styles.grid}>
          {PREMIUM_EXCLUSIVES.map((w) => (
            <WallpaperCard key={w.id} wallpaper={w} width={cardWidth} />
          ))}
        </View>

        <Text style={styles.legal}>
          Payment is charged to your Google Play / Apple ID account at confirmation of purchase. Premium is a one-time,
          non-consumable purchase tied to your store account and can be restored on any device with the same account.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { height: 260, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  collage: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  collageImg: { width: 110, height: 196, borderRadius: radius.md, marginHorizontal: -10, borderWidth: 2, borderColor: colors.gold },
  kicker: { color: colors.gold, fontWeight: '800', letterSpacing: 2, textAlign: 'center', marginTop: 4 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center', marginTop: 6, paddingHorizontal: 16 },
  perks: { margin: 16, padding: 16, gap: 14, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  perk: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  perkIcon: { color: colors.gold, fontSize: 22, width: 28, textAlign: 'center' },
  perkTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
  perkSub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  once: { color: colors.textDim, textAlign: 'center', marginTop: 10 },
  restore: { color: colors.accent2, fontWeight: '600' },
  note: { color: colors.textDim, textAlign: 'center', fontSize: 12, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  legal: { color: colors.textDim, fontSize: 11, lineHeight: 16, margin: 16, marginTop: 24 },
});
