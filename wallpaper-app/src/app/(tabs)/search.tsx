import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '../../components/ui';
import { WallpaperGrid } from '../../components/WallpaperGrid';
import { CATEGORIES } from '../../data/categories';
import { useFeed } from '../../lib/useFeed';
import { aiSearchPage, interleave, searchExclusives, searchPhotos } from '../../lib/wallpapers';
import { colors, radius } from '../../theme';

const SUGGESTIONS = ['dark aesthetic', 'neon tiger', 'sunset beach', 'galaxy', 'lamborghini', 'anime sky', 'gold marble', 'rain window'];

export default function Search() {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  const loadPage = useCallback(
    async (page: number) => {
      if (!query) return [];
      const photos = await searchPhotos(query, page).catch(() => []);
      const mixed = interleave(aiSearchPage(query, page), photos);
      return page === 0 ? [...searchExclusives(query), ...mixed] : mixed;
    },
    [query],
  );
  const { items, loading, loadMore } = useFeed(loadPage);

  const submit = (q: string) => {
    setText(q);
    setQuery(q.trim());
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Text style={styles.title}>Search</Text>
      <View style={styles.inputWrap}>
        <Text style={styles.icon}>⌕</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => submit(text)}
          placeholder="Search any wallpaper… e.g. neon lion"
          placeholderTextColor={colors.textDim}
          returnKeyType="search"
          style={styles.input}
          autoCorrect={false}
        />
        {text ? (
          <Pressable onPress={() => submit('')} hitSlop={10}>
            <Text style={styles.clear}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={SUGGESTIONS}
        keyExtractor={(s) => s}
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 12 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => <Chip label={item} active={item === query} onPress={() => submit(item)} />}
      />
      {query ? (
        <WallpaperGrid data={items} loading={loading} onEndReached={loadMore} emptyText={`No results for “${query}”.`} />
      ) : (
        <FlatList
          data={CATEGORIES}
          numColumns={2}
          keyExtractor={(c) => c.id}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 10, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.cat}
              onPress={() => router.push({ pathname: '/category/[id]', params: { id: item.id } })}
            >
              <Text style={{ fontSize: 26 }}>{item.emoji}</Text>
              <Text style={styles.catName}>{item.name}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', paddingHorizontal: 16, paddingTop: 8 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { color: colors.textDim, fontSize: 20, marginRight: 8 },
  input: { flex: 1, color: colors.text, fontSize: 16 },
  clear: { color: colors.textDim, fontSize: 16 },
  cat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catName: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
