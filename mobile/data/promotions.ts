import type { Promotion } from "@/types";

// Helper: dates relative to "now" for the demo
const now = new Date();
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 86400000).toISOString();
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 86400000).toISOString();

export const promotions: Promotion[] = [
  // --- Bebidas ---
  { id: "promo_001", productId: "prod_001", storeId: "store_001", originalPrice: 10.99, promoPrice: 7.49, startDate: daysAgo(2), endDate: daysFromNow(5), status: "active", verified: true, source: "manual" },
  { id: "promo_002", productId: "prod_001", storeId: "store_002", originalPrice: 10.99, promoPrice: 8.29, startDate: daysAgo(1), endDate: daysFromNow(3), status: "active", verified: true, source: "crawler" },
  { id: "promo_003", productId: "prod_002", storeId: "store_003", originalPrice: 7.49, promoPrice: 4.99, startDate: daysAgo(3), endDate: daysFromNow(4), status: "active", verified: true, source: "manual" },
  { id: "promo_004", productId: "prod_003", storeId: "store_001", originalPrice: 3.99, promoPrice: 2.49, startDate: daysAgo(1), endDate: daysFromNow(0.5), status: "active", verified: true, source: "manual" },  // Expiring soon
  { id: "promo_005", productId: "prod_004", storeId: "store_004", originalPrice: 5.99, promoPrice: 3.99, startDate: daysAgo(2), endDate: daysFromNow(6), status: "active", verified: false, source: "crawler" },
  { id: "promo_006", productId: "prod_004", storeId: "store_001", originalPrice: 5.99, promoPrice: 4.49, startDate: daysAgo(1), endDate: daysFromNow(2), status: "active", verified: true, source: "manual" },

  // --- Limpeza ---
  { id: "promo_007", productId: "prod_005", storeId: "store_001", originalPrice: 2.99, promoPrice: 1.49, startDate: daysAgo(3), endDate: daysFromNow(4), status: "active", verified: true, source: "manual" },
  { id: "promo_008", productId: "prod_005", storeId: "store_002", originalPrice: 2.99, promoPrice: 1.79, startDate: daysAgo(2), endDate: daysFromNow(0.8), status: "active", verified: true, source: "crawler" }, // Expiring soon
  { id: "promo_009", productId: "prod_006", storeId: "store_003", originalPrice: 15.99, promoPrice: 9.99, startDate: daysAgo(1), endDate: daysFromNow(7), status: "active", verified: true, source: "manual" },
  { id: "promo_010", productId: "prod_006", storeId: "store_004", originalPrice: 15.99, promoPrice: 11.49, startDate: daysAgo(2), endDate: daysFromNow(5), status: "active", verified: false, source: "importador_ia" },
  { id: "promo_011", productId: "prod_007", storeId: "store_001", originalPrice: 6.49, promoPrice: 3.99, startDate: daysAgo(1), endDate: daysFromNow(3), status: "active", verified: true, source: "manual" },

  // --- Alimentos ---
  { id: "promo_012", productId: "prod_008", storeId: "store_002", originalPrice: 27.99, promoPrice: 19.99, startDate: daysAgo(4), endDate: daysFromNow(3), status: "active", verified: true, source: "manual" },
  { id: "promo_013", productId: "prod_008", storeId: "store_003", originalPrice: 27.99, promoPrice: 21.49, startDate: daysAgo(2), endDate: daysFromNow(5), status: "active", verified: true, source: "crawler" },
  { id: "promo_014", productId: "prod_009", storeId: "store_001", originalPrice: 8.99, promoPrice: 5.99, startDate: daysAgo(1), endDate: daysFromNow(4), status: "active", verified: true, source: "manual" },
  { id: "promo_015", productId: "prod_010", storeId: "store_004", originalPrice: 4.49, promoPrice: 2.99, startDate: daysAgo(3), endDate: daysFromNow(0.3), status: "active", verified: true, source: "manual" }, // Expiring soon
  { id: "promo_016", productId: "prod_011", storeId: "store_002", originalPrice: 7.99, promoPrice: 5.49, startDate: daysAgo(2), endDate: daysFromNow(6), status: "active", verified: false, source: "importador_ia" },

  // --- Hortifruti ---
  { id: "promo_017", productId: "prod_012", storeId: "store_001", originalPrice: 5.99, promoPrice: 3.49, startDate: daysAgo(1), endDate: daysFromNow(2), status: "active", verified: true, source: "manual" },
  { id: "promo_018", productId: "prod_013", storeId: "store_003", originalPrice: 8.49, promoPrice: 4.99, startDate: daysAgo(2), endDate: daysFromNow(3), status: "active", verified: true, source: "manual" },
  { id: "promo_019", productId: "prod_014", storeId: "store_002", originalPrice: 6.99, promoPrice: 3.99, startDate: daysAgo(1), endDate: daysFromNow(4), status: "active", verified: true, source: "crawler" },
  { id: "promo_020", productId: "prod_015", storeId: "store_004", originalPrice: 4.99, promoPrice: 2.99, startDate: daysAgo(3), endDate: daysFromNow(5), status: "active", verified: true, source: "manual" },

  // --- Padaria ---
  { id: "promo_021", productId: "prod_016", storeId: "store_001", originalPrice: 14.99, promoPrice: 9.99, startDate: daysAgo(1), endDate: daysFromNow(1), status: "active", verified: true, source: "manual" },
  { id: "promo_022", productId: "prod_017", storeId: "store_003", originalPrice: 18.99, promoPrice: 12.99, startDate: daysAgo(2), endDate: daysFromNow(3), status: "active", verified: false, source: "importador_ia" },
  { id: "promo_023", productId: "prod_018", storeId: "store_002", originalPrice: 3.99, promoPrice: 1.99, startDate: daysAgo(1), endDate: daysFromNow(0.7), status: "active", verified: true, source: "manual" }, // Expiring soon

  // --- Higiene ---
  { id: "promo_024", productId: "prod_019", storeId: "store_004", originalPrice: 4.49, promoPrice: 2.49, startDate: daysAgo(2), endDate: daysFromNow(5), status: "active", verified: true, source: "manual" },
  { id: "promo_025", productId: "prod_020", storeId: "store_001", originalPrice: 19.99, promoPrice: 12.99, startDate: daysAgo(1), endDate: daysFromNow(4), status: "active", verified: true, source: "crawler" },
  { id: "promo_026", productId: "prod_020", storeId: "store_003", originalPrice: 19.99, promoPrice: 14.49, startDate: daysAgo(3), endDate: daysFromNow(6), status: "active", verified: true, source: "manual" },
  { id: "promo_027", productId: "prod_021", storeId: "store_002", originalPrice: 5.99, promoPrice: 3.49, startDate: daysAgo(2), endDate: daysFromNow(3), status: "active", verified: true, source: "manual" },

  // Extra cross-store deals
  { id: "promo_028", productId: "prod_008", storeId: "store_001", originalPrice: 27.99, promoPrice: 22.99, startDate: daysAgo(1), endDate: daysFromNow(2), status: "active", verified: true, source: "manual" },
  { id: "promo_029", productId: "prod_012", storeId: "store_004", originalPrice: 5.99, promoPrice: 3.99, startDate: daysAgo(2), endDate: daysFromNow(3), status: "active", verified: false, source: "crawler" },
];
