import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import { CATEGORIES } from '../data/categories';
import { colors, radius } from '../theme';

const TINTS: [string, string][] = [
  ['#4C1D95', '#0E7490'],
  ['#831843', '#4C1D95'],
  ['#065F46', '#1E3A8A'],
  ['#7C2D12', '#831843'],
  ['#1E3A8A', '#0F766E'],
];

export function CategoryStrip() {
  return (
    <FlatList
      horizontal
      data={CATEGORIES}
      keyExtractor={(c) => c.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
      renderItem={({ item, index }) => (
        <Pressable onPress={() => router.push({ pathname: '/category/[id]', params: { id: item.id } })}>
          <LinearGradient colors={TINTS[index % TINTS.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.name}>{item.name}</Text>
          </LinearGradient>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  tile: { width: 96, height: 96, borderRadius: radius.md, padding: 10, justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border },
  emoji: { fontSize: 28 },
  name: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
