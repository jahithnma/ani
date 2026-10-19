import { Directory, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { Platform } from 'react-native';

import type { Wallpaper } from './wallpapers';

/** Downloads the full-resolution image and saves it to the photo gallery. */
export async function saveToGallery(w: Wallpaper): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(w.full, '_blank');
    return;
  }
  const perm = await requestPermissionsAsync(true);
  if (!perm.granted) throw new Error('Allow photo access to save wallpapers.');

  const dir = new Directory(Paths.cache, 'downloads');
  dir.create({ idempotent: true });
  const safeId = w.id.replace(/[^a-z0-9-]/gi, '_');
  const file = await File.downloadFileAsync(w.full, new File(dir, `${safeId}.jpg`), { idempotent: true });
  try {
    await Asset.create(file.uri);
  } finally {
    file.delete();
  }
}
