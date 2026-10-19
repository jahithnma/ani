import AsyncStorage from '@react-native-async-storage/async-storage';

import { FREE_DAILY_GENERATIONS } from '../config';

const KEY = 'studio.quota';
const today = () => new Date().toISOString().slice(0, 10);

/** Remaining free AI Studio generations for today. */
export async function remainingGenerations(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY).catch(() => null);
  const data = raw ? (JSON.parse(raw) as { day: string; used: number }) : null;
  const used = data?.day === today() ? data.used : 0;
  return Math.max(0, FREE_DAILY_GENERATIONS - used);
}

export async function consumeGeneration(): Promise<void> {
  const left = await remainingGenerations();
  const used = FREE_DAILY_GENERATIONS - left + 1;
  await AsyncStorage.setItem(KEY, JSON.stringify({ day: today(), used })).catch(() => {});
}
