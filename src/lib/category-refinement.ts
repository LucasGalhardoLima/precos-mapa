/**
 * Name-based corrections to a product's category_l2, applied after a category has been
 * proposed — by a Savegnago leaf (tree) or by the LLM. Pure and shared, so the tree
 * backfill, the daily scraper and the LLM pass (which the daily job reuses) all decide
 * the same way. PM decisions from the audit of the sample.
 */

// Slugs of the Higiene department (product_categories.department_id = 'cat_higiene').
const HIGIENE_SLUGS = new Set([
  "papel-higienico-lencos", "cabelo", "corpo-banho", "saude-bucal", "higiene-intima-absorventes", "beleza-maquiagem",
]);

// Slugs of the food departments: Mercearia, Bebidas, Laticínios e frios, Carnes, Congelados,
// Hortifruti, Padaria. A test checks this list against the seeded product_categories.
export const FOOD_SLUGS: ReadonlySet<string> = new Set([
  "arroz", "feijao-graos", "massas", "molhos-condimentos", "oleos-azeites", "acucar-adocantes", "cafe", "matinais",
  "farinhas-fermentos", "conservas", "temperos", "biscoitos", "salgadinhos-snacks", "doces-chocolates",
  "sobremesas-preparos", "sopas-pratos-prontos", "saudaveis-suplementos", "castanhas-frutas-secas",
  "agua", "refrigerante", "suco", "cerveja", "vinho-espumante", "destilados", "energetico-isotonico", "cha",
  "leite", "iogurte-fermentado", "queijos", "manteiga-margarina", "requeijao-creme-leite", "frios-embutidos",
  "bovina", "aves", "suina", "peixes-frutos-do-mar", "outras-carnes",
  "prontos-congelados", "sorvete-acai", "vegetais-polpas",
  "frutas", "legumes-verduras", "ovos",
  "paes", "bolos-confeitaria",
]);

// A JS \b does not treat "ê" as a word character, so the boundary is spelled out.
const BABY_RE = /(?<![a-zà-ú])(?:beb[êe]s?|baby|infantil)(?![a-zà-ú])/i;

/**
 * Name-based corrections applied on top of a leaf's category (the tree only knows the
 * shelf, not what the product is). PM decisions from the audit of the sample:
 *  - a Higiene product with bebê / baby / infantil in the name is "higiene-infantil";
 *  - paper towels ("toalha de papel", "papel toalha") are "papel-higienico-lencos", even
 *    though Savegnago shelves them with disposables;
 *  - "defensivo" (garden pesticide, shelved under Jardinagem) is "inseticidas-odorizadores";
 *  - a name with "for kids", "brinquedo" or "kit infantil" is not food: if it was put in a
 *    food category it goes to "outros". Outside food nothing changes (pet toys stay in pet).
 */
export function refineCategoryL2(slug: string, name: string): string {
  if (/(?<![a-zà-ú])defensivo(?![a-zà-ú])/i.test(name)) return "inseticidas-odorizadores";
  if (/toalhas?\s+(?:de\s+)?papel|papel\s+toalha/i.test(name)) return "papel-higienico-lencos";
  // "Giovanna Baby" is a fragrance brand (deodorants, body splash), not a baby product.
  if (HIGIENE_SLUGS.has(slug) && BABY_RE.test(name.replace(/giovanna\s+baby/gi, " "))) return "higiene-infantil";
  if (FOOD_SLUGS.has(slug) && /for\s+kids|brinquedo|kit\s+infantil/i.test(name)) return "outros";
  return slug;
}
