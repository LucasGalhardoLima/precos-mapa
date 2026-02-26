// =============================================================================
// Union Types (matching database enums)
// =============================================================================

export type UserRole = 'consumer' | 'business' | 'super_admin';
export type B2BPlan = 'free' | 'premium' | 'premium_plus' | 'enterprise';
export type B2CPlan = 'free' | 'plus' | 'family';
export type PromotionStatus = 'active' | 'expired' | 'pending_review';
export type PromotionSource = 'manual' | 'importador_ia' | 'crawler';
export type StoreMemberRole = 'owner' | 'admin' | 'staff';
export type SortMode = 'cheapest' | 'nearest' | 'expiring';

// =============================================================================
// Database Row Types (matching Supabase tables)
// =============================================================================

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  search_radius_km: number;
  b2c_plan: B2CPlan;
  rc_customer_id: string | null;
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  name: string;
  chain: string | null;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  logo_url: string | null;
  logo_initial: string;
  logo_color: string;
  phone: string | null;
  b2b_plan: B2BPlan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  search_priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreMember {
  id: string;
  store_id: string;
  user_id: string;
  role: StoreMemberRole;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  category_id: string;
  brand: string | null;
  reference_price: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductSynonym {
  id: string;
  term: string;
  product_id: string;
  created_at: string;
}

export interface Promotion {
  id: string;
  product_id: string;
  store_id: string;
  original_price: number;
  promo_price: number;
  start_date: string;
  end_date: string;
  status: PromotionStatus;
  verified: boolean;
  source: PromotionSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserFavorite {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface UserAlert {
  id: string;
  user_id: string;
  product_id: string;
  target_price: number | null;
  radius_km: number;
  is_active: boolean;
  created_at: string;
}

export interface Testimonial {
  id: string;
  user_name: string;
  text: string;
  savings_amount: number;
  sort_order: number;
}

export interface PlatformStats {
  id: number;
  user_count: string;
  city_name: string;
  avg_monthly_savings: string;
  updated_at: string;
}

export interface ShoppingList {
  id: string;
  user_id: string;
  name: string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: string;
  list_id: string;
  product_id: string;
  quantity: number;
  is_checked: boolean;
  created_at: string;
}

export interface PriceSnapshot {
  id: string;
  product_id: string;
  date: string;
  min_promo_price: number | null;
  avg_promo_price: number | null;
  store_count: number;
  reference_price: number | null;
  created_at: string;
}

// =============================================================================
// Joined / Enriched Types (computed client-side)
// =============================================================================

/** Promotion with joined product and store data (from Supabase query) */
export interface PromotionWithRelations extends Promotion {
  product: Product;
  store: Store;
}

/** Enriched promotion with computed display fields */
export interface EnrichedPromotion extends PromotionWithRelations {
  discountPercent: number;
  belowNormalPercent: number;
  gamificationMessage: string | null;
  distanceKm: number;
  isExpiringSoon: boolean;
  isBestPrice: boolean;
}

/** Store with computed promotion data (for map) */
export interface StoreWithPromotions {
  store: Store;
  activePromotionCount: number;
  topDeals: EnrichedPromotion[];
  distanceKm: number;
}

/** Favorite with joined product and active promotions */
export interface FavoriteWithProduct extends UserFavorite {
  product: Product & {
    promotions: PromotionWithRelations[];
  };
}

/** Alert with joined product */
export interface AlertWithProduct extends UserAlert {
  product: Product;
}

// =============================================================================
// Social Proof (for backward compatibility with components)
// =============================================================================

export interface SocialProofStats {
  userCount: string;
  cityName: string;
  avgMonthlySavings: string;
}
