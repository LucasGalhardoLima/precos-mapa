import type { Promotion } from "@/types";

// Helper: dates relative to "now" for the demo
const now = new Date();
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 86400000).toISOString();
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 86400000).toISOString();

const ts = now.toISOString();

export const promotions: Promotion[] = [
  // --- Bebidas ---
  { id: "promo_001", product_id: "prod_001", store_id: "store_001", original_price: 10.99, promo_price: 7.49, start_date: daysAgo(2), end_date: daysFromNow(5), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_002", product_id: "prod_001", store_id: "store_002", original_price: 10.99, promo_price: 8.29, start_date: daysAgo(1), end_date: daysFromNow(3), status: "active", verified: true, source: "crawler", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_003", product_id: "prod_002", store_id: "store_003", original_price: 7.49, promo_price: 4.99, start_date: daysAgo(3), end_date: daysFromNow(4), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_004", product_id: "prod_003", store_id: "store_001", original_price: 3.99, promo_price: 2.49, start_date: daysAgo(1), end_date: daysFromNow(0.5), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },  // Expiring soon
  { id: "promo_005", product_id: "prod_004", store_id: "store_004", original_price: 5.99, promo_price: 3.99, start_date: daysAgo(2), end_date: daysFromNow(6), status: "active", verified: false, source: "crawler", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_006", product_id: "prod_004", store_id: "store_001", original_price: 5.99, promo_price: 4.49, start_date: daysAgo(1), end_date: daysFromNow(2), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },

  // --- Limpeza ---
  { id: "promo_007", product_id: "prod_005", store_id: "store_001", original_price: 2.99, promo_price: 1.49, start_date: daysAgo(3), end_date: daysFromNow(4), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_008", product_id: "prod_005", store_id: "store_002", original_price: 2.99, promo_price: 1.79, start_date: daysAgo(2), end_date: daysFromNow(0.8), status: "active", verified: true, source: "crawler", created_by: null, created_at: ts, updated_at: ts }, // Expiring soon
  { id: "promo_009", product_id: "prod_006", store_id: "store_003", original_price: 15.99, promo_price: 9.99, start_date: daysAgo(1), end_date: daysFromNow(7), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_010", product_id: "prod_006", store_id: "store_004", original_price: 15.99, promo_price: 11.49, start_date: daysAgo(2), end_date: daysFromNow(5), status: "active", verified: false, source: "importador_ia", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_011", product_id: "prod_007", store_id: "store_001", original_price: 6.49, promo_price: 3.99, start_date: daysAgo(1), end_date: daysFromNow(3), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },

  // --- Alimentos ---
  { id: "promo_012", product_id: "prod_008", store_id: "store_002", original_price: 27.99, promo_price: 19.99, start_date: daysAgo(4), end_date: daysFromNow(3), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_013", product_id: "prod_008", store_id: "store_003", original_price: 27.99, promo_price: 21.49, start_date: daysAgo(2), end_date: daysFromNow(5), status: "active", verified: true, source: "crawler", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_014", product_id: "prod_009", store_id: "store_001", original_price: 8.99, promo_price: 5.99, start_date: daysAgo(1), end_date: daysFromNow(4), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_015", product_id: "prod_010", store_id: "store_004", original_price: 4.49, promo_price: 2.99, start_date: daysAgo(3), end_date: daysFromNow(0.3), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts }, // Expiring soon
  { id: "promo_016", product_id: "prod_011", store_id: "store_002", original_price: 7.99, promo_price: 5.49, start_date: daysAgo(2), end_date: daysFromNow(6), status: "active", verified: false, source: "importador_ia", created_by: null, created_at: ts, updated_at: ts },

  // --- Hortifruti ---
  { id: "promo_017", product_id: "prod_012", store_id: "store_001", original_price: 5.99, promo_price: 3.49, start_date: daysAgo(1), end_date: daysFromNow(2), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_018", product_id: "prod_013", store_id: "store_003", original_price: 8.49, promo_price: 4.99, start_date: daysAgo(2), end_date: daysFromNow(3), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_019", product_id: "prod_014", store_id: "store_002", original_price: 6.99, promo_price: 3.99, start_date: daysAgo(1), end_date: daysFromNow(4), status: "active", verified: true, source: "crawler", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_020", product_id: "prod_015", store_id: "store_004", original_price: 4.99, promo_price: 2.99, start_date: daysAgo(3), end_date: daysFromNow(5), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },

  // --- Padaria ---
  { id: "promo_021", product_id: "prod_016", store_id: "store_001", original_price: 14.99, promo_price: 9.99, start_date: daysAgo(1), end_date: daysFromNow(1), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_022", product_id: "prod_017", store_id: "store_003", original_price: 18.99, promo_price: 12.99, start_date: daysAgo(2), end_date: daysFromNow(3), status: "active", verified: false, source: "importador_ia", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_023", product_id: "prod_018", store_id: "store_002", original_price: 3.99, promo_price: 1.99, start_date: daysAgo(1), end_date: daysFromNow(0.7), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts }, // Expiring soon

  // --- Higiene ---
  { id: "promo_024", product_id: "prod_019", store_id: "store_004", original_price: 4.49, promo_price: 2.49, start_date: daysAgo(2), end_date: daysFromNow(5), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_025", product_id: "prod_020", store_id: "store_001", original_price: 19.99, promo_price: 12.99, start_date: daysAgo(1), end_date: daysFromNow(4), status: "active", verified: true, source: "crawler", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_026", product_id: "prod_020", store_id: "store_003", original_price: 19.99, promo_price: 14.49, start_date: daysAgo(3), end_date: daysFromNow(6), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_027", product_id: "prod_021", store_id: "store_002", original_price: 5.99, promo_price: 3.49, start_date: daysAgo(2), end_date: daysFromNow(3), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },

  // Extra cross-store deals
  { id: "promo_028", product_id: "prod_008", store_id: "store_001", original_price: 27.99, promo_price: 22.99, start_date: daysAgo(1), end_date: daysFromNow(2), status: "active", verified: true, source: "manual", created_by: null, created_at: ts, updated_at: ts },
  { id: "promo_029", product_id: "prod_012", store_id: "store_004", original_price: 5.99, promo_price: 3.99, start_date: daysAgo(2), end_date: daysFromNow(3), status: "active", verified: false, source: "crawler", created_by: null, created_at: ts, updated_at: ts },
];
