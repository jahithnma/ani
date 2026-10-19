import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, GradientButton } from '../../components/ui';
import { FREE_DAILY_GENERATIONS } from '../../config';
import { usePremium } from '../../lib/premium';
import { consumeGeneration, remainingGenerations } from '../../lib/quota';
import { studioWallpaper, type Wallpaper } from '../../lib/wallpapers';
import { colors, radius } from '../../theme';

const STYLES = [
  { label: 'None', value: '' },
  { label: 'Cinematic', value: 'cinematic, dramatic lighting, film still' },
  { label: 'Anime', value: 'anime style, makoto shinkai, vibrant' },
  { label: '3D Render', value: 'octane render, 3d, glossy, studio lighting' },
  { label: 'Neon', value: 'neon glow, cyberpunk colors, dark background' },
  { label: 'Oil Paint', value: 'oil painting, thick brush strokes, impressionism' },
  { label: 'AMOLED', value: 'pure black background, minimal, glowing' },
  { label: 'Watercolor', value: 'soft watercolor, paper texture, pastel' },
];

const IDEAS = ['A lion made of galaxies', 'Floating city above the clouds at sunset', 'Neon koi fish in black water', 'Crystal mountains under two moons'];

export default function Studio() {
  const { isPremium } = usePremium();
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(STYLES[1].value);
  const [result, setResult] = useState<Wallpaper | null>(null);
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState(FREE_DAILY_GENERATIONS);

  useFocusEffect(
    useCallback(() => {
      remainingGenerations().then(setLeft);
    }, []),
  );

  const generate = async () => {
    const p = prompt.trim();
    if (!p) return;
    if (!isPremium && left <= 0) {
      Alert.alert('Daily limit reached', 'Go Premium for unlimited AI generations in higher resolution.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Go Premium', onPress: () => router.push('/premium') },
      ]);
      return;
    }
    setLoading(true);
    setResult(studioWallpaper(p, style, isPremium));
    if (!isPremium) {
      await consumeGeneration();
      setLeft(await remainingGenerations());
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>AI Studio ✦</Text>
        <Text style={styles.sub}>
          Describe your dream wallpaper.{' '}
          {isPremium ? 'Unlimited · 2K generations.' : `${left} of ${FREE_DAILY_GENERATIONS} free today.`}
        </Text>

        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="e.g. a tiger made of northern lights"
          placeholderTextColor={colors.textDim}
          multiline
          style={styles.input}
        />
        <View style={styles.ideas}>
          {IDEAS.map((i) => (
            <Pressable key={i} onPress={() => setPrompt(i)}>
              <Text style={styles.idea}>💡 {i}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Style</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {STYLES.map((s) => (
            <Chip key={s.label} label={s.label} active={style === s.value} onPress={() => setStyle(s.value)} />
          ))}
        </ScrollView>

        <GradientButton title="Generate wallpaper" onPress={generate} loading={loading} disabled={!prompt.trim()} style={{ margin: 16 }} />

        {result ? (
          <Pressable
            style={styles.preview}
            onPress={() => !loading && router.push({ pathname: '/wallpaper/[id]', params: { id: result.id } })}
          >
            <Image
              source={{ uri: result.full }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={400}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                Alert.alert('Generation failed', 'The AI server is busy. Please try again in a moment.');
              }}
            />
            {loading ? (
              <View style={styles.generating}>
                <ActivityIndicator color={colors.accent2} size="large" />
                <Text style={styles.generatingText}>Painting your wallpaper…</Text>
              </View>
            ) : (
              <View style={styles.tapHint}>
                <Text style={styles.tapHintText}>Tap to open · save · favorite</Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', paddingHorizontal: 16, paddingTop: 8 },
  sub: { color: colors.textDim, paddingHorizontal: 16, marginTop: 4 },
  input: {
    margin: 16,
    minHeight: 110,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    padding: 14,
    textAlignVertical: 'top',
  },
  ideas: { paddingHorizontal: 16, gap: 6 },
  idea: { color: colors.accent2, fontSize: 14 },
  label: { color: colors.text, fontWeight: '700', fontSize: 16, margin: 16, marginBottom: 10 },
  preview: {
    marginHorizontal: 16,
    aspectRatio: 9 / 16,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  generating: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(7,7,12,0.6)' },
  generatingText: { color: colors.text, fontWeight: '600' },
  tapHint: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  tapHintText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
