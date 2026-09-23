import { z } from "zod";

const CATEGORY_MAP: Record<string, string> = {
  bebidas: "cat_bebidas",
  limpeza: "cat_limpeza",
  alimentos: "cat_alimentos",
  hortifruti: "cat_hortifruti",
  padaria: "cat_padaria",
  higiene: "cat_higiene",
  laticinios: "cat_laticinios",
  congelados: "cat_congelados",
  pet: "cat_pet",
  bebes: "cat_bebes",
};

// Unicode-aware word boundary, shared by the brand-matching patterns below
// (\b doesn't work with accented chars — á, ê, ã, etc. — so this uses
// explicit boundary patterns instead).
const WB = `(?:^|(?<=[\\s,;()\\-/]))`;  // lookbehind: start or separator
const WE = `(?=$|[\\s,;()\\-/])`;       // lookahead: end or separator

// ---------------------------------------------------------------------------
// Brand extraction from product name
// ---------------------------------------------------------------------------

/** Known Brazilian grocery brands — sorted longest-first for greedy matching */
const KNOWN_BRANDS: string[] = [
  // Multi-word brands (must come first)
  "Tio João", "Dona Benta", "São Braz", "Mãe Terra", "Leite de Rosas",
  "Bom Ar", "Lava Roupas", "Pinho Sol", "Veja Limpeza", "Guaraná Antarctica",
  "Del Valle", "Matte Leão", "Red Bull", "Café Pelé", "Café Melitta",
  "Café Pilão", "Café 3 Corações", "Leite Moça", "Creme de Leite Nestlé",
  // Single-word brands
  "Nestlé", "Sadia", "Perdigão", "Seara", "Aurora", "Friboi", "Minerva",
  "Omo", "Ariel", "Comfort", "Ypê", "Brilhante", "Downy",
  "Coca-Cola", "Pepsi", "Fanta", "Sprite", "Guaraná", "Skol", "Brahma",
  "Antarctica", "Heineken", "Budweiser", "Stella Artois", "Corona", "Amstel",
  "Parmalat", "Italac", "Piracanjuba", "Elegê", "Ninho", "Molico",
  "Pomarola", "Fugini", "Quero", "Predilecta", "Elma Chips", "Ruffles",
  "Doritos", "Cheetos", "Toddy", "Nescau", "Ovomaltine",
  "Hellmanns", "Heinz", "Knorr", "Maggi", "Sazon", "Kitano",
  "Renata", "Barilla", "Adria", "Galo", "Isabela",
  "Colgate", "Oral-B", "Dove", "Nivea", "Rexona", "Lux", "Protex",
  "Pampers", "Huggies", "Personal", "Neve", "Harpic", "Veja", "Lysol",
  "Tang", "Clight", "Fresh", "Kapo",
  "Bauducco", "Visconti", "Wickbold", "Pullman", "Panco", "Seven Boys",
  "Danone", "Vigor", "Batavo", "Itambé", "Tirolez", "Polenghi",
  "Camil", "Kicaldo", "Yoki", "Amafil", "Hikari",
  "Liza", "Soya", "Concórdia",
  "Pilão", "Melitta", "Pelé", "3 Corações", "Baggio",
  "Nutella", "Nescafé", "Sucrilhos", "Mucilon", "Farinha Láctea",
];

/** Regex-escaped brand patterns, built once — uses Unicode-aware boundaries */
const BRAND_PATTERNS: [RegExp, string][] = KNOWN_BRANDS.map((brand) => [
  new RegExp(`${WB}${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${WE}`, "i"),
  brand,
]);

/** Size/unit tokens to ignore during heuristic brand extraction */
const SIZE_UNIT_RE = /^\d+(?:[.,]\d+)?\s*(?:ml|l|g|kg|un|pct|pack|und|unid|cx|lt|gr)$/i;

export function extractBrand(name: string): string | null {
  // 1. Try known brands first (longest match wins since list is sorted)
  for (const [regex, brand] of BRAND_PATTERNS) {
    if (regex.test(name)) {
      return brand;
    }
  }

  // 2. Heuristic: look for capitalized multi-word tokens that aren't size/units
  //    e.g., "Arroz Tio João 5kg" → skip "5kg", could pick "Tio João" if it were unknown
  //    Keep this conservative — only match patterns like "Word Word" at start or after product type
  const tokens = name.split(/\s+/);
  for (let i = 0; i < tokens.length && i < 5; i++) {
    const token = tokens[i];
    // Skip size tokens, lowercase words (generic), single chars
    if (SIZE_UNIT_RE.test(token) || token.length <= 1) continue;
    if (token[0] !== token[0].toUpperCase()) continue;
    // Skip common generic product type words
    if (/^(Arroz|Feijão|Açúcar|Farinha|Óleo|Leite|Café|Cerveja|Refrigerante|Detergente|Sabão|Sabonete|Shampoo|Papel|Macarrão|Molho|Biscoito|Bolacha|Queijo|Presunto|Carne|Frango|Pão|Suco|Água|Sal|Azeite|Manteiga|Margarina|Iogurte|Chocolate)$/i.test(token)) continue;

    // Check if this starts a brand-like sequence (2+ capitalized words)
    if (i + 1 < tokens.length && tokens[i + 1][0] === tokens[i + 1][0]?.toUpperCase() && !SIZE_UNIT_RE.test(tokens[i + 1])) {
      return `${token} ${tokens[i + 1]}`;
    }
  }

  return null;
}

export function normalizeCategory(value: unknown): string {
  if (typeof value !== "string") {
    return "cat_alimentos";
  }
  const key = value.trim().toLowerCase();
  return CATEGORY_MAP[key] ?? "cat_alimentos";
}


// =============================================================================
// Supabase / Stripe schemas (production)
// =============================================================================

/** Stripe webhook event validation */
export const stripeWebhookSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
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
