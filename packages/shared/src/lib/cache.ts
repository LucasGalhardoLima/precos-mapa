import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function getCached<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache:${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(`cache:${key}`, JSON.stringify(entry));
  } catch {
    // Cache write failure is non-critical
  }
}

export function isCacheStale(timestamp: number, ttlMs: number = DEFAULT_TTL_MS): boolean {
  return Date.now() - timestamp > ttlMs;
}

export function formatLastUpdated(timestamp: number): string {
  const date = new Date(timestamp);
  return `Ultima atualizacao: ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/**
 * Wraps a Supabase query with offline caching.
 * - On success: returns fresh data and updates cache
 * - On network error: returns cached data if available
 */
export async function withCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T | null>,
  ttlMs?: number,
): Promise<{ data: T | null; fromCache: boolean; lastUpdated: number | null }> {
  try {
    const data = await fetcher();
    if (data !== null) {
      await setCache(cacheKey, data);
      return { data, fromCache: false, lastUpdated: Date.now() };
    }
    // Null response — try cache
    const cached = await getCached<T>(cacheKey);
    return {
      data: cached?.data ?? null,
      fromCache: !!cached,
      lastUpdated: cached?.timestamp ?? null,
    };
  } catch {
    // Network error — fall back to cache
    const cached = await getCached<T>(cacheKey);
    return {
      data: cached?.data ?? null,
      fromCache: !!cached,
      lastUpdated: cached?.timestamp ?? null,
    };
  }
}
