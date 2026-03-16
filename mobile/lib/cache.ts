// Re-export from shared package (specific path to avoid barrel import)
export {
  getCached,
  setCache,
  isCacheStale,
  formatLastUpdated,
  withCache,
} from '@poup/shared/lib/cache';
