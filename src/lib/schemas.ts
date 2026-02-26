import { z } from "zod";

export const ProductSchema = z.object({
  name: z.string().describe("Nome do produto formatado (ex: Arroz Tio João)."),
  price: z.number().describe("Preço numérico do produto (ex: 29.90)."),
  original_price: z.number().nullable().optional().describe("Preço original antes da promoção (ex: 'de 5.99 por 3.99' → 5.99). Se não houver, null."),
  unit: z.enum(["kg", "un", "l", "g", "ml", "pack"]).describe("Unidade de medida padronizada."),
  validity: z.string().nullable().describe("Data de validade da promoção no formato YYYY-MM-DD. Se não houver, null."),
  market_origin: z.string().optional().describe("Nome do supermercado de origem (ex: Savegnago)."),
  category: z.string().optional().describe("Categoria do produto (ex: Bebidas, Limpeza, Alimentos, Hortifruti, Padaria, Higiene)."),
});

export const EncarteSchema = z.object({
  products: z.array(ProductSchema),
});

export type EncarteProduct = z.infer<typeof ProductSchema>;
export type EncarteResponse = z.infer<typeof EncarteSchema>;

const RawProductSchema = z.object({
  name: z.unknown(),
  price: z.unknown(),
  original_price: z.unknown().optional(),
  unit: z.unknown(),
  validity: z.unknown().optional(),
  market_origin: z.unknown().optional(),
  category: z.unknown().optional(),
});

const CATEGORY_MAP: Record<string, string> = {
  bebidas: "cat_bebidas",
  limpeza: "cat_limpeza",
  alimentos: "cat_alimentos",
  hortifruti: "cat_hortifruti",
  padaria: "cat_padaria",
  higiene: "cat_higiene",
};

export function normalizeCategory(value: unknown): string {
  if (typeof value !== "string") {
    return "cat_alimentos";
  }
  const key = value.trim().toLowerCase();
  return CATEGORY_MAP[key] ?? "cat_alimentos";
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }
  return normalized;
}

function normalizePrice(value: unknown): number | null {
  if (typeof value === "number") {
    if (Number.isFinite(value) && value > 0 && value < 10_000) {
      return Number(value.toFixed(2));
    }
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  let text = value.trim();
  if (!text) {
    return null;
  }

  text = text.replace(/[R$\s]/gi, "").replace(/[^\d,.-]/g, "");
  if (!text) {
    return null;
  }

  const commaIndex = text.lastIndexOf(",");
  const dotIndex = text.lastIndexOf(".");

  if (commaIndex >= 0 && dotIndex >= 0) {
    if (commaIndex > dotIndex) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (commaIndex >= 0) {
    text = text.replace(",", ".");
  }

  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 10_000) {
    return null;
  }

  return Number(parsed.toFixed(2));
}

function normalizeUnit(value: unknown): EncarteProduct["unit"] | null {
  if (typeof value !== "string") {
    return null;
  }

  const unit = value.trim().toLowerCase();
  if (!unit) {
    return null;
  }

  if (unit === "kg" || unit.includes("quilo")) return "kg";
  if (unit === "un" || unit.includes("und") || unit.includes("unid") || unit.includes("cada")) return "un";
  if (unit === "l" || unit.includes("litro")) return "l";
  if (unit === "g" || unit.includes("grama")) return "g";
  if (unit === "ml") return "ml";
  if (unit === "pack" || unit.includes("pct") || unit.includes("pacote")) return "pack";

  return null;
}

function normalizeValidity(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    return `${slash[3]}-${month}-${day}`;
  }

  const dash = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dash) {
    const day = dash[1].padStart(2, "0");
    const month = dash[2].padStart(2, "0");
    return `${dash[3]}-${month}-${day}`;
  }

  return null;
}

function normalizeMarketOrigin(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || undefined;
}

export function normalizeProducts(input: unknown): EncarteProduct[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const items: EncarteProduct[] = [];
  const dedupe = new Set<string>();

  for (const candidate of input) {
    const parsed = RawProductSchema.safeParse(candidate);
    if (!parsed.success) {
      continue;
    }

    const name = normalizeName(parsed.data.name);
    const price = normalizePrice(parsed.data.price);
    const original_price = normalizePrice(parsed.data.original_price) ?? undefined;
    const unit = normalizeUnit(parsed.data.unit);
    const validity = normalizeValidity(parsed.data.validity);
    const market_origin = normalizeMarketOrigin(parsed.data.market_origin);
    const category = normalizeCategory(parsed.data.category);

    if (!name || price === null || !unit) {
      continue;
    }

    const product: EncarteProduct = {
      name,
      price,
      ...(original_price !== undefined && original_price > price ? { original_price } : {}),
      unit,
      validity,
      ...(market_origin ? { market_origin } : {}),
      category,
    };

    const dedupeKey = `${product.name}|${product.price}|${product.unit}|${product.validity ?? ""}`;
    if (dedupe.has(dedupeKey)) {
      continue;
    }

    dedupe.add(dedupeKey);
    items.push(product);
  }

  return items;
}

export function normalizeEncartePayload(payload: unknown): EncarteResponse {
  const candidateProducts =
    typeof payload === "object" && payload !== null && "products" in payload
      ? (payload as { products?: unknown }).products
      : undefined;

  return {
    products: normalizeProducts(candidateProducts),
  };
}

// =============================================================================
// Supabase / Stripe schemas (production)
// =============================================================================

/** Stripe webhook event validation */
export const stripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.unknown()),
  }),
});

export type StripeWebhookEvent = z.infer<typeof stripeWebhookSchema>;

/** Promotion form validation (admin panel) */
export const promotionFormSchema = z.object({
  product_id: z.string().uuid('ID do produto invalido'),
  original_price: z.number().positive('Preco original deve ser positivo'),
  promo_price: z.number().positive('Preco promocional deve ser positivo'),
  start_date: z.string().datetime('Data de inicio invalida'),
  end_date: z.string().datetime('Data de fim invalida'),
}).refine(
  (data) => data.promo_price < data.original_price,
  { message: 'Preco promocional deve ser menor que o preco original', path: ['promo_price'] }
).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'Data de fim deve ser posterior a data de inicio', path: ['end_date'] }
);

export type PromotionFormData = z.infer<typeof promotionFormSchema>;

/** Checkout session input validation */
export const checkoutSchema = z.object({
  priceId: z.string().min(1, 'Price ID obrigatorio'),
  storeId: z.string().uuid('Store ID invalido'),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
