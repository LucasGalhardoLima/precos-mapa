// Types
export * from './types';

// Lib
export { supabase } from './lib/supabase';
export {
  promotionSchema,
  storeSetupSchema,
  alertSchema,
  profileUpdateSchema,
} from './lib/schemas';
export type {
  PromotionFormData,
  StoreSetupFormData,
  AlertFormData,
  ProfileUpdateData,
} from './lib/schemas';
export {
  getCached,
  setCache,
  isCacheStale,
  formatLastUpdated,
  withCache,
} from './lib/cache';

// Store
export { useAuthStore } from './store/auth-store';

// Constants
export { Colors } from './constants/colors';
export { DEMO_USER_LOCATION, getGamificationMessage } from './constants/messages';

// Hooks
export { useAuth } from './hooks/use-auth';
export { useLocation, calculateDistanceKm } from './hooks/use-location';
export { useRealtime } from './hooks/use-realtime';
export { usePushNotifications } from './hooks/use-push-notifications';

// Components
export { AuthButtons } from './components/auth-buttons';
export { OfflineBanner } from './components/offline-banner';
export { StyledButton } from './components/ui/button';
export { Badge } from './components/ui/badge';
export { StyledText } from './components/ui/text';
