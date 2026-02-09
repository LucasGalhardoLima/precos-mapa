export type UserRole = "super_admin" | "admin_mercado";

export type Permission =
  | "dashboard:market:view"
  | "dashboard:global:view"
  | "offer:view"
  | "offer:create"
  | "offer:edit"
  | "offer:publish"
  | "market:manage"
  | "user:manage"
  | "plan:manage"
  | "moderation:manage"
  | "importer:use";

export type RolePermissions = Record<UserRole, Permission[]>;

export interface SessionContext {
  role: UserRole;
  currentMarketId: string;
  availableMarketIds: string[];
  userName: string;
  userEmail: string;
}

export type DashboardScope = "global" | "market";

export type MarketStatus = "ativo" | "pendente" | "suspenso";

export interface MarketSummary {
  id: string;
  name: string;
  city: string;
  state: string;
  status: MarketStatus;
  plan: "Free" | "Pro" | "Enterprise";
  activeOffers: number;
  monthlyViews: number;
  monthlyClicks: number;
  conversionRate: number;
}

export interface PlatformKpi {
  id: string;
  label: string;
  value: string;
  trend: "up" | "down" | "stable";
  delta: string;
}

export interface MarketKpi {
  id: string;
  label: string;
  value: string;
  helper: string;
}

export type OfferStatus = "ativa" | "rascunho" | "expirada";

export interface Offer {
  id: string;
  marketId: string;
  productName: string;
  brand: string;
  category: string;
  unit: "kg" | "un" | "l" | "g" | "ml" | "pack";
  price: number;
  listPrice: number;
  discountPercent: number;
  validUntil: string;
  verified: boolean;
  status: OfferStatus;
  source: "manual" | "importador_ia";
  createdAt: string;
  note?: string;
}

export interface PromotionDraft {
  productName: string;
  brand: string;
  category: string;
  unit: "kg" | "un" | "l" | "g" | "ml" | "pack";
  price: number;
  listPrice: number;
  validUntil: string;
  note?: string;
}

export interface ProductComparison {
  productName: string;
  bestPrice: number;
  worstPrice: number;
  marketWithBestPrice: string;
  marketWithWorstPrice: string;
}

export interface AlertPreference {
  id: string;
  title: string;
  category: string;
  maxPrice: number;
  isEnabled: boolean;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "analista" | "suporte";
  status: "ativo" | "inativo";
  lastAccess: string;
}

export interface ModerationItem {
  id: string;
  marketName: string;
  offerName: string;
  reason: string;
  createdAt: string;
  status: "pendente" | "aprovado" | "rejeitado";
}

export interface PlanOverview {
  id: string;
  marketName: string;
  plan: "Free" | "Pro" | "Enterprise";
  amount: string;
  renewalDate: string;
  status: "ativo" | "atrasado" | "trial";
}
