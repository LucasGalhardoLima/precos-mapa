// Re-export from shared package (specific path to avoid barrel import)
export {
  getCached,
  setCache,
  isCacheStale,
  formatLastUpdated,
  withCache,
} from '@precomapa/shared/lib/cache';
