import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { registerWallpapers, type Wallpaper } from './wallpapers';

const KEY = 'favorites.v1';

type FavoritesState = {
  favorites: Wallpaper[];
  isFavorite: (id: string) => boolean;
  toggle: (w: Wallpaper) => void;
};

const FavoritesContext = createContext<FavoritesState | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Wallpaper[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setFavorites(registerWallpapers(JSON.parse(raw))))
      .catch(() => {});
  }, []);

  const toggle = useCallback((w: Wallpaper) => {
    setFavorites((prev) => {
      const next = prev.some((f) => f.id === w.id) ? prev.filter((f) => f.id !== w.id) : [w, ...prev];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ favorites, toggle, isFavorite: (id: string) => favorites.some((f) => f.id === id) }),
    [favorites, toggle],
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used inside FavoritesProvider');
  return ctx;
}
