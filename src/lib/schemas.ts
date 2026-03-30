import { z } from "zod";

export const ProductSchema = z.object({
  name: z.string().describe("Nome do produto formatado (ex: Arroz Tio João)."),
  price: z.number().describe("Preço numérico do produto (ex: 29.90)."),
  original_price: z.number().nullable().optional().describe("Preço original antes da promoção (ex: 'de 5.99 por 3.99' → 5.99). Se não houver, null."),
  unit: z.enum(["kg", "un", "l", "g", "ml", "pack", "dz"]).describe("Unidade de medida padronizada."),
  validity: z.string().nullable().describe("Data de validade da promoção no formato YYYY-MM-DD. Se não houver, null."),
  market_origin: z.string().optional().describe("Nome do supermercado de origem (ex: Savegnago)."),
  category: z.string().optional().describe("Categoria do produto (ex: Bebidas, Limpeza, Alimentos, Hortifruti, Padaria, Higiene)."),
  brand: z.string().optional().describe("Marca do produto extraída do nome (ex: Tio João, Omo, Coca-Cola)."),
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
  laticinios: "cat_laticinios",
  congelados: "cat_congelados",
  pet: "cat_pet",
  bebes: "cat_bebes",
};

// ---------------------------------------------------------------------------
// Category keyword auto-assignment from product name
// ---------------------------------------------------------------------------
// Unicode-aware word boundary: \b doesn't work with accented chars (á, ê, ã, etc.)
// Use explicit boundary patterns instead.
const WB = `(?:^|(?<=[\\s,;()\\-/]))`;  // lookbehind: start or separator
const WE = `(?=$|[\\s,;()\\-/])`;       // lookahead: end or separator

const CATEGORY_KEYWORDS: [RegExp, string][] = [
  // Limpeza (before bebidas: "agua sanitaria" must match before standalone "agua")
  [new RegExp(`${WB}(sabao|detergente|amaciante|desinfetante|agua sanitaria|alvejante|esponja|limpador|multiuso|cera|lustra|inseticida|saco de lixo|pano|vassoura|rodo|limpa vidro|desengordurante|cloro|saponaceo)${WE}`, "i"), "cat_limpeza"],
  // Pet (before alimentos: "racao" should not fall into alimentos)
  [new RegExp(`${WB}(racao|petisco|areia|antipulgas|coleira|comedouro|brinquedo pet)${WE}`, "i"), "cat_pet"],
  // Bebês (before higiene: "fralda" overlap — bebês is more specific)
  [new RegExp(`${WB}(fralda|mamadeira|papinha|chupeta|lenco umedecido bebe)${WE}`, "i"), "cat_bebes"],
  // Bebidas
  [new RegExp(`${WB}(cerveja|chopp?|vinho|espumante|refrigerante|suco|sucha|agua|guarana|energetico|vodka|whisky|whiskey|cachaca|licor|gin|tequila|champagne|ice|drink|nectar|isotonico|cha gelado|mate|agua de coco|cha)${WE}`, "i"), "cat_bebidas"],
  // Hortifruti
  [new RegExp(`${WB}(banana|maca|laranja|limao|tomate|batata|cebola|alho|cenoura|alface|rucula|morango|melancia|abacaxi|manga|mamao|uva|pera|pessego|ameixa|kiwi|pepino|abobrinha|berinjela|pimentao|brocolis|couve|repolho|coentro|salsinha|mandioca|inhame|chuchu|quiabo|gengibre|beterraba)${WE}`, "i"), "cat_hortifruti"],
  // Padaria
  [new RegExp(`${WB}(pao|bisnaga|baguete|croissant|rosca|bolo|torta|panetone|colomba|bisnagas|sonho|cuca|pao de queijo|brioche)${WE}`, "i"), "cat_padaria"],
  // Higiene (fralda removed — now in cat_bebes)
  [new RegExp(`${WB}(shampoo|condicionador|sabonete|creme dental|escova dental|desodorante|papel higienico|absorvente|cotonete|fio dental|protetor solar|hidratante|pasta de dente|algodao|esmalte)${WE}`, "i"), "cat_higiene"],
  // Laticínios (before alimentos: specific dairy products)
  [new RegExp(`${WB}(leite|queijo|iogurte|manteiga|requeijao|creme de leite|cream cheese|ricota|mussarela|parmesao|provolone|coalho)${WE}`, "i"), "cat_laticinios"],
  // Congelados
  [new RegExp(`${WB}(congelado|sorvete|lasanha congelada|pizza congelada|nuggets|hamburguer congelado|polpa de fruta|acai|picole)${WE}`, "i"), "cat_congelados"],
  // Alimentos (broad — matched last as fallback above cat_alimentos default)
  [new RegExp(`${WB}(arroz|feijao|macarrao|farinha|acucar|sal|oleo|azeite|cafe|margarina|presunto|salame|mortadela|linguica|salsicha|carne|frango|peixe|atum|sardinha|milho|ervilha|molho|ketchup|mostarda|maionese|biscoito|bolacha|cereal|aveia|granola|leite condensado|chocolate|achocolatado|gelatina|pudim|ovo|ovos|noz|castanha|amendoim|vinagre|tempero|caldo|extrato de tomate|polvilho|tapioca)${WE}`, "i"), "cat_alimentos"],
];

/** Strip diacritics for accent-insensitive matching */
function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function inferCategoryFromName(name: string): string | null {
  const normalized = stripAccents(name);
  for (const [regex, catId] of CATEGORY_KEYWORDS) {
    if (regex.test(normalized)) {
      return catId;
    }
  }
  return null;
}

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
  if (unit === "dz" || unit.includes("duzia") || unit.includes("dúzia")) return "dz";
  if (unit === "cx" || unit.includes("caixa")) return "pack";
  if (unit === "bd" || unit.includes("bandeja")) return "un";

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

  let dateStr: string | null = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    dateStr = text;
  }

  if (!dateStr) {
    const slash = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
      const day = slash[1].padStart(2, "0");
      const month = slash[2].padStart(2, "0");
      dateStr = `${slash[3]}-${month}-${day}`;
    }
  }

  if (!dateStr) {
    const dash = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dash) {
      const day = dash[1].padStart(2, "0");
      const month = dash[2].padStart(2, "0");
      dateStr = `${dash[3]}-${month}-${day}`;
    }
  }

  if (!dateStr) {
    return null;
  }

  // Sanity check: reject dates in the past or > 90 days in the future
  const parsed = new Date(dateStr + "T00:00:00");
  if (isNaN(parsed.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (parsed < now) return null;
  const maxFuture = new Date(now);
  maxFuture.setDate(maxFuture.getDate() + 90);
  if (parsed > maxFuture) return null;

  return dateStr;
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

    // Auto-assign category from product name if Claude didn't provide one
    // or if the provided category defaulted to cat_alimentos
    let finalCategory = category;
    if (finalCategory === "cat_alimentos") {
      const inferred = inferCategoryFromName(name);
      if (inferred) {
        finalCategory = inferred;
      }
    }

    // Extract brand from product name
    const brand = extractBrand(name);

    const product: EncarteProduct = {
      name,
      price,
      ...(original_price !== undefined && original_price > price ? { original_price } : {}),
      unit,
      validity,
      ...(market_origin ? { market_origin } : {}),
      category: finalCategory,
      ...(brand ? { brand } : {}),
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
