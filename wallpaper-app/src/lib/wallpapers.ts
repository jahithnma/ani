import {
  ASSET_BASE_URL,
  PEXELS_API_KEY,
  POLLINATIONS_REFERRER,
  POLLINATIONS_TOKEN,
} from '../config';
import { CATEGORIES, QUALITY_SUFFIX, type Category } from '../data/categories';
import generated from '../data/generated.json';

export type WallpaperSource = 'exclusive' | 'ai' | 'photo';

export type Wallpaper = {
  id: string;
  title: string;
  thumb: string;
  full: string;
  width: number;
  height: number;
  premium: boolean;
  source: WallpaperSource;
  category?: string;
  credit?: string;
  creditUrl?: string;
};

// Screens receive only an id in the route, so every wallpaper that is shown
// is remembered here and looked up by the viewer.
const registry = new Map<string, Wallpaper>();
const remember = (list: Wallpaper[]) => {
  list.forEach((w) => registry.set(w.id, w));
  return list;
};
export const getWallpaper = (id: string) => registry.get(id);
export const registerWallpapers = remember;

// ---------------------------------------------------------------- exclusives
type GeneratedEntry = {
  id: string;
  tier: 'premium' | 'free';
  title: string;
  category: string;
  width: number;
  height: number;
};

export const EXCLUSIVES: Wallpaper[] = remember(
  (generated as GeneratedEntry[]).map((g) => ({
    id: g.id,
    title: g.title,
    thumb: `${ASSET_BASE_URL}/thumbs/${g.id}.jpg`,
    full: `${ASSET_BASE_URL}/${g.tier}/${g.id}.jpg`,
    width: g.width,
    height: g.height,
    premium: g.tier === 'premium',
    source: 'exclusive',
    category: g.category,
    credit: 'Wallpaper 8K Originals',
  })),
);

export const PREMIUM_EXCLUSIVES = EXCLUSIVES.filter((w) => w.premium);
export const FREE_EXCLUSIVES = EXCLUSIVES.filter((w) => !w.premium);

// ---------------------------------------------------------------- AI images
export const AI_WIDTH = 1080;
export const AI_HEIGHT = 1920;

export function aiImageUrl(prompt: string, seed: number, width = AI_WIDTH, height = AI_HEIGHT) {
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seed),
    nologo: 'true',
    enhance: 'true',
    model: 'flux',
    referrer: POLLINATIONS_REFERRER,
  });
  if (POLLINATIONS_TOKEN) params.set('token', POLLINATIONS_TOKEN);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function aiWallpaper(
  prompt: string,
  seed: number,
  category?: string,
  title?: string,
  size: { width: number; height: number } = { width: AI_WIDTH, height: AI_HEIGHT },
): Wallpaper {
  const url = aiImageUrl(`${prompt}, ${QUALITY_SUFFIX}`, seed, size.width, size.height);
  return {
    id: `ai-${hash(prompt)}-${seed}-${size.width}`,
    title: title ?? titleCase(prompt.split(',')[0]).slice(0, 40),
    thumb: url,
    full: url,
    width: size.width,
    height: size.height,
    premium: false,
    source: 'ai',
    category,
    credit: 'AI generated',
  };
}

/** A one-off image from the AI Studio. */
export function studioWallpaper(prompt: string, style: string, hd: boolean): Wallpaper {
  const seed = Math.floor(Math.random() * 1_000_000);
  const size = hd ? { width: 1440, height: 2560 } : { width: AI_WIDTH, height: AI_HEIGHT };
  const full = style ? `${prompt}, ${style}` : prompt;
  return remember([aiWallpaper(full, seed, undefined, titleCase(prompt).slice(0, 40), size)])[0];
}

/** A page of AI wallpapers for a category: every page uses new seeds. */
export function aiCategoryPage(category: Category, page: number): Wallpaper[] {
  return remember(
    category.prompts.map((p, i) => aiWallpaper(p, 1000 + page * 97 + i * 13 + hash(category.id) % 500, category.id)),
  );
}

export function aiSearchPage(query: string, page: number, count = 6): Wallpaper[] {
  const styles = ['', 'digital art', 'photorealistic', 'dreamy pastel', 'dark moody', 'vibrant neon'];
  return remember(
    Array.from({ length: count }, (_, i) => {
      const style = styles[i % styles.length];
      const prompt = style ? `${query}, ${style}` : query;
      return aiWallpaper(prompt, 7 + page * 31 + i, undefined, titleCase(query));
    }),
  );
}

/** Mixed "Trending" feed across all categories. */
export function trendingPage(page: number): Wallpaper[] {
  const out: Wallpaper[] = [];
  for (let i = 0; i < 8; i++) {
    const cat = CATEGORIES[(page * 8 + i) % CATEGORIES.length];
    const prompt = cat.prompts[(page + i) % cat.prompts.length];
    out.push(aiWallpaper(prompt, 500 + page * 17 + i, cat.id));
  }
  return remember(out);
}

// ---------------------------------------------------------------- photos
type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographer_url: string;
  src: { original: string; large2x: string; portrait: string };
};

export const photosEnabled = () => PEXELS_API_KEY.length > 0;

export async function searchPhotos(query: string, page: number): Promise<Wallpaper[]> {
  if (!photosEnabled()) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&size=large&per_page=16&page=${page + 1}`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res.ok) return [];
  const data: { photos: PexelsPhoto[] } = await res.json();
  return remember(
    data.photos.map((p) => ({
      id: `px-${p.id}`,
      title: p.alt ? titleCase(p.alt).slice(0, 40) : 'Photo',
      thumb: p.src.portrait,
      // `original` is the full camera resolution (often 6000px+).
      full: p.src.original,
      width: p.width,
      height: p.height,
      premium: false,
      source: 'photo' as const,
      credit: `Photo by ${p.photographer} on Pexels`,
      creditUrl: p.photographer_url,
    })),
  );
}

export function exclusivesFor(categoryId: string) {
  return EXCLUSIVES.filter((w) => w.category === categoryId);
}

export function searchExclusives(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return EXCLUSIVES.filter((w) => w.title.toLowerCase().includes(q) || w.category?.includes(q));
}

/** Interleave two lists so photos and AI art are mixed in a feed. */
export function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

export function resolutionLabel(w: Wallpaper) {
  const long = Math.max(w.width, w.height);
  if (long >= 7680) return '8K';
  if (long >= 3840) return '4K';
  if (long >= 2560) return '2K';
  return 'HD';
}
