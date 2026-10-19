import { useCallback, useEffect, useRef, useState } from 'react';

import type { Wallpaper } from './wallpapers';

/** Paged feed: `loadPage(n)` returns the n-th page (sync or async). */
export function useFeed(loadPage: (page: number) => Wallpaper[] | Promise<Wallpaper[]>, maxPages = 25) {
  const [items, setItems] = useState<Wallpaper[]>([]);
  const [loading, setLoading] = useState(false);
  const page = useRef(0);
  const busy = useRef(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    if (busy.current || page.current >= maxPages) return;
    busy.current = true;
    setLoading(true);
    const gen = generation.current;
    try {
      const next = await loadPage(page.current);
      if (gen !== generation.current) return;
      page.current += 1;
      setItems((prev) => {
        const seen = new Set(prev.map((w) => w.id));
        return [...prev, ...next.filter((w) => !seen.has(w.id))];
      });
    } catch (e) {
      console.warn('feed error', e);
    } finally {
      if (gen === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, [loadPage, maxPages]);

  useEffect(() => {
    generation.current += 1;
    page.current = 0;
    busy.current = false;
    setItems([]);
    load();
  }, [load]);

  return { items, loading, loadMore: load };
}
