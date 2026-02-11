export type CategoryId =
  | "cat_todos"
  | "cat_bebidas"
  | "cat_limpeza"
  | "cat_alimentos"
  | "cat_hortifruti"
  | "cat_padaria"
  | "cat_higiene";

export type StorePlan = "free" | "pro" | "enterprise";

export type PromotionStatus = "active" | "expired";

export type PromotionSource = "manual" | "importador_ia" | "crawler";

export type SortMode = "cheapest" | "nearest" | "expiring";

export interface Product {
  id: string;
  name: string;
  category: CategoryId;
  brand?: string;
  referencePrice: number;
  imageUrl?: string;
}

export interface Promotion {
  id: string;
  productId: string;
  storeId: string;
  originalPrice: number;
  promoPrice: number;
  startDate: string;
  endDate: string;
  status: PromotionStatus;
  verified: boolean;
  source: PromotionSource;
}

export interface Store {
  id: string;
  name: string;
  chain?: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  logoInitial: string;
  logoColor: string;
  plan: StorePlan;
  activeOfferCount: number;
}

export interface Category {
  id: CategoryId;
  name: string;
  icon: string;
  sortOrder: number;
}

export interface Testimonial {
  id: string;
  userName: string;
  text: string;
  savingsAmount: number;
}

export interface SocialProofStats {
  userCount: string;
  cityName: string;
  avgMonthlySavings: string;
}

export interface EnrichedPromotion {
  id: string;
  product: Product;
  store: Store;
  originalPrice: number;
  promoPrice: number;
  startDate: string;
  endDate: string;
  verified: boolean;
  discountPercent: number;
  belowNormalPercent: number;
  gamificationMessage: string | null;
  distanceKm: number;
  isExpiringSoon: boolean;
}

export interface StoreWithPromotions {
  store: Store;
  activePromotionCount: number;
  topDeals: EnrichedPromotion[];
  distanceKm: number;
}
