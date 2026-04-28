/**
 * One-time bulk seed script: populates the products table from Cosmos by Bluesoft.
 *
 * Usage (Node 20+):
 *   npx tsx --env-file=.env.local scripts/seed-cosmos-catalog.ts
 *
 * Or with dotenv installed:
 *   npx tsx scripts/seed-cosmos-catalog.ts  (requires dotenv in package.json)
 *
 * Required env vars (add to .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   COSMOS_API_TOKEN        (primary token)
 *   COSMOS_API_TOKEN_2      (secondary token — rotated to double daily quota)
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const COSMOS_TOKENS         = [
  process.env.COSMOS_API_TOKEN   ?? '',
  process.env.COSMOS_API_TOKEN_2 ?? '',
  process.env.COSMOS_API_TOKEN_3 ?? '',
].filter(Boolean);

const COSMOS_BASE           = 'https://api.cosmos.bluesoft.com.br';
const PER_PAGE              = 90;
const DELAY_MS              = 400; // polite delay between Cosmos calls

// ---------------------------------------------------------------------------
// Search terms organized by Poup category
// Expand this list as needed — each term costs 1 Cosmos query.
// ---------------------------------------------------------------------------

const SEED_TERMS: Record<string, string[]> = {
  cat_alimentos: [
    // Grãos e cereais
    'arroz', 'feijão', 'lentilha', 'grão de bico', 'ervilha', 'milho', 'aveia', 'quinoa', 'granola',
    // Farinhas e básicos
    'farinha de trigo', 'farinha de mandioca', 'fubá', 'amido de milho', 'fermento em pó', 'açúcar', 'sal', 'açúcar mascavo',
    // Massas
    'macarrão', 'espaguete', 'penne', 'lasanha', 'talharim', 'macarrão instantâneo',
    // Óleos e gorduras
    'óleo de soja', 'óleo de girassol', 'azeite de oliva', 'óleo de coco', 'margarina',
    // Molhos e temperos
    'molho de tomate', 'extrato de tomate', 'ketchup', 'maionese', 'mostarda', 'tempero completo',
    'molho shoyu', 'vinagre', 'pimenta', 'colorau', 'orégano',
    // Conservas e enlatados
    'atum enlatado', 'sardinha enlatada', 'milho enlatado', 'palmito', 'azeitona', 'seleta de legumes', 'ervilha enlatada',
    // Laticínios
    'leite integral', 'leite desnatado', 'leite semidesnatado', 'leite condensado', 'creme de leite',
    'queijo mussarela', 'queijo prato', 'requeijão', 'iogurte natural', 'iogurte grego',
    'manteiga com sal', 'manteiga sem sal',
    // Proteínas e frios
    'frango congelado', 'peito de frango', 'coxinha da asa', 'coxa de frango',
    'carne bovina moída', 'acém bovino', 'patinho bovino',
    'linguiça toscana', 'salsicha', 'mortadela', 'presunto', 'bacon fatiado',
    'ovo de galinha',
    // Café e bebidas quentes
    'café torrado moído', 'café solúvel', 'chá preto', 'achocolatado em pó', 'cappuccino',
    // Doces e snacks
    'biscoito recheado', 'bolacha cream cracker', 'bolacha maria', 'cookie', 'wafer',
    'chocolate ao leite', 'barra de chocolate', 'bala', 'chiclete',
    'maionese de frango', 'chips de batata', 'salgadinho', 'pipoca para micro-ondas',
  ],

  cat_bebidas: [
    // Refrigerantes
    'coca-cola', 'pepsi cola', 'guaraná antarctica', 'sprite', 'fanta laranja',
    'refrigerante limão', 'refrigerante zero',
    // Sucos e néctares
    'suco de laranja', 'néctar de laranja', 'suco de uva', 'néctar de uva',
    'suco de goiaba', 'suco de maracujá', 'suco de manga', 'suco de caju',
    'suco de tomate', 'Del Valle', 'suco néctar',
    // Água
    'água mineral sem gás', 'água mineral com gás', 'água de coco',
    // Cervejas
    'cerveja lata', 'cerveja long neck', 'skol lata', 'brahma lata', 'antarctica lata',
    'heineken long neck', 'corona extra', 'budweiser lata', 'stella artois', 'eisenbahn',
    // Vinhos e espumantes
    'vinho tinto seco', 'vinho branco seco', 'vinho rosé', 'espumante',
    // Energéticos e isotônicos
    'red bull', 'monster energy', 'gatorade', 'powerade', 'energético',
    // Leite e bebidas lácteas
    'leite uht integral', 'bebida láctea', 'yakult', 'iogurte para beber',
  ],

  cat_hortifruti: [
    // Frutas
    'banana prata', 'banana nanica', 'maçã fuji', 'laranja pera', 'uva sem semente',
    'mamão formosa', 'abacaxi pérola', 'pera williams', 'manga palmer', 'melancia',
    'limão tahiti', 'morango', 'kiwi', 'melão', 'goiaba',
    // Verduras e legumes
    'tomate salada', 'tomate cereja', 'alface lisa', 'alface crespa', 'rúcula',
    'cenoura', 'cebola', 'batata inglesa', 'alho', 'chuchu', 'abobrinha',
    'brócolis', 'couve', 'espinafre', 'pepino', 'pimentão vermelho', 'pimentão verde',
    'beterraba', 'mandioca', 'batata doce', 'inhame', 'jiló', 'quiabo', 'berinjela',
    // Temperos frescos
    'salsa', 'cebolinha', 'coentro',
  ],

  cat_padaria: [
    // Pães
    'pão de forma branco', 'pão de forma integral', 'pão francês', 'pão de queijo',
    'pão hot dog', 'pão hamburger', 'brioche', 'torrada', 'torrada integral',
    'pão sírio', 'wrap de trigo', 'pão de mel',
    // Bolos e sobremesas
    'mistura para bolo chocolate', 'mistura para bolo baunilha', 'mistura para bolo laranja',
    'bolo de cenoura', 'bolo de milho', 'brownie',
    // Biscoitos tipo padaria
    'biscoito polvilho', 'biscoito de queijo', 'rosquinha',
    // Massas frescas
    'massa de lasanha fresca', 'nhoque de batata',
  ],

  cat_higiene: [
    // Cabelo
    'shampoo anticaspa', 'shampoo hidratante', 'condicionador', 'creme de pentear',
    'máscara capilar', 'shampoo seco', 'leave-in',
    // Pele e corpo
    'sabonete em barra', 'sabonete líquido', 'hidratante corporal', 'protetor solar',
    'gel de banho', 'esfoliante corporal',
    // Higiene bucal
    'creme dental', 'creme dental clareador', 'enxaguante bucal', 'fio dental',
    'escova de dentes',
    // Desodorante
    'desodorante roll-on', 'desodorante aerossol', 'antitranspirante',
    // Feminino
    'absorvente externo', 'absorvente interno', 'protetor diário',
    // Bebê
    'fralda descartável', 'lenço umedecido', 'talco infantil',
    // Masculino
    'aparelho de barbear', 'creme de barbear', 'gel pós-barba',
    // Papel e descartáveis
    'papel higiênico', 'papel toalha', 'guardanapo de papel', 'lenço de papel',
  ],

  cat_limpeza: [
    // Louça e cozinha
    'detergente líquido', 'esponja de louça', 'sabão em pedra', 'lava-louças',
    'desgordurante', 'pano de prato',
    // Roupas
    'sabão em pó', 'sabão líquido roupas', 'amaciante', 'tira-manchas', 'alvejante',
    // Casa
    'desinfetante', 'multiuso spray', 'limpa vidros', 'cera para piso',
    'álcool 70 graus', 'álcool gel', 'água sanitária',
    // Banheiro
    'limpador banheiro', 'desincrostante',
    // Sacos e acessórios
    'saco de lixo', 'rodo', 'vassoura', 'esponja de aço',
  ],
};

// ---------------------------------------------------------------------------
// Cosmos API types
// ---------------------------------------------------------------------------

interface CosmosProduct {
  gtin:        string | number;
  description: string;
  brand?:      { name: string };
  thumbnail?:  string;
  avg_price?:  number | null;
  gpc?:        { code: string; description: string };
  category?:   { id: number; description: string; parent_id: number | null };
}

// Cosmos category id → Poup category_id
// Built from live API responses. When category is absent, falls back to search term category.
// Description-based matching is the secondary signal for unmapped IDs.
function resolveCategory(
  cosmos: CosmosProduct['category'],
  fallback: string,
): string {
  if (!cosmos) return fallback;

  // Map by Cosmos category ID (most stable)
  const BY_ID: Record<number, string> = {
    // Alimentos
    1: 'cat_alimentos',   // parent: Alimentos/Cereais/Grãos
    3: 'cat_alimentos',   // Arroz
    7: 'cat_alimentos',   // Café
    60: 'cat_alimentos',  // Iogurte
    156: 'cat_alimentos', // Biscoito Salgado
    157: 'cat_higiene',   // Shampoo
    198: 'cat_alimentos', // Doces
    // Bebidas
    65: 'cat_bebidas',    // parent: Bebidas
    205: 'cat_bebidas',   // Refrigerantes
    // Higiene
    507: 'cat_higiene',   // parent: Higiene/Beleza
    // Limpeza
    259: 'cat_limpeza',   // parent: Limpeza
  };

  if (BY_ID[cosmos.id]) return BY_ID[cosmos.id];
  if (cosmos.parent_id && BY_ID[cosmos.parent_id]) return BY_ID[cosmos.parent_id];

  // Secondary: keyword match on description
  const desc = cosmos.description.toLowerCase();
  if (/bebida|refrigerante|suco|cerveja|vinho|água|energético|isotônico/.test(desc)) return 'cat_bebidas';
  if (/higiene|shampoo|sabonete|creme|desodorante|fralda|absorvente|dental|cabelo/.test(desc)) return 'cat_higiene';
  if (/limpeza|detergente|sabão|desinfetante|amaciante|alvejante/.test(desc)) return 'cat_limpeza';
  if (/fruta|verdura|legume|hortali|tubérculo/.test(desc)) return 'cat_hortifruti';
  if (/pão|bolo|panificação|torrada|biscoito de polvilho/.test(desc)) return 'cat_padaria';

  return fallback;
}

interface CosmosResponse {
  products?: CosmosProduct[];
}

// ---------------------------------------------------------------------------
// Token rotation
// ---------------------------------------------------------------------------

let tokenIndex = 0;

function nextToken(): { token: string; number: number } {
  const idx = tokenIndex % COSMOS_TOKENS.length;
  tokenIndex++;
  return { token: COSMOS_TOKENS[idx], number: idx + 1 };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (COSMOS_TOKENS.length === 0) {
    console.error('Missing COSMOS_API_TOKEN');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Load GPC→category map from DB once
  const { data: gpcRows, error: gpcError } = await supabase
    .from('cosmos_gpc_map')
    .select('gpc_code, category_id');
  if (gpcError) console.warn('cosmos_gpc_map load failed — using search-term category for all products:', gpcError.message);
  const gpcMap = new Map<string, string>((gpcRows ?? []).map((r) => [r.gpc_code, r.category_id]));

  let totalUpserted      = 0;
  let totalSkipped       = 0;
  let totalErrors        = 0;
  let queryCount         = 0;
  let consecutiveRateLimit = 0;

  const categoryEntries = Object.entries(SEED_TERMS);

  outer:
  for (const [categoryId, terms] of categoryEntries) {
    console.log(`\n── Category: ${categoryId} (${terms.length} terms) ──`);

    for (const term of terms) {
      queryCount++;
      const { token, number: tokenNum } = nextToken();

      let cosmosProducts: CosmosProduct[] = [];

      try {
        const res = await fetch(
          `${COSMOS_BASE}/products?query=${encodeURIComponent(term)}&per_page=${PER_PAGE}`,
          {
            headers: {
              'X-Cosmos-Token': token,
              'User-Agent':     'Cosmos-API-Request',
              'Content-Type':   'application/json',
            },
          }
        );

        if (!res.ok) {
          if (res.status === 429) {
            consecutiveRateLimit++;
            if (consecutiveRateLimit >= 3) {
              console.error('\n3 consecutive 429s — quota likely exhausted for both tokens. Stopping early.');
              break outer;
            }
            console.warn(`  [${term}] Rate limited (429) — pausing 60s (${consecutiveRateLimit}/3)`);
            await sleep(60_000);
            continue;
          }
          console.warn(`  [${term}] Cosmos error ${res.status}`);
          totalErrors++;
          continue;
        }

        consecutiveRateLimit = 0;
        const data: CosmosProduct[] | CosmosResponse = await res.json();
        cosmosProducts = Array.isArray(data) ? data : (data.products ?? []);
      } catch (err) {
        console.warn(`  [${term}] Fetch failed:`, err);
        totalErrors++;
        continue;
      }

      // Filter out records with no GTIN or description — price is optional
      const valid = cosmosProducts.filter(
        (cp) => cp.gtin && cp.gtin !== 0 && cp.description
      );

      if (valid.length === 0) {
        console.log(`  [${term}] 0 usable results`);
        totalSkipped++;
        await sleep(DELAY_MS);
        continue;
      }

      const rows = valid.map((cp) => ({
        ean:              String(cp.gtin),
        name:             toTitleCase(cp.description),
        brand:            cp.brand?.name ?? null,
        image_url:        cp.thumbnail ?? null,
        reference_price:  cp.avg_price && cp.avg_price > 0 ? cp.avg_price : null,
        // Priority: GPC DB map → Cosmos category → search term category
        category_id:      gpcMap.get(cp.gpc?.code ?? '') ?? resolveCategory(cp.category, categoryId),
        cosmos_synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('products')
        .upsert(rows, { onConflict: 'ean', ignoreDuplicates: false });

      if (error) {
        console.error(`  [${term}] Upsert error:`, error.message);
        totalErrors++;
      } else {
        console.log(`  [${term}] ✓ ${valid.length} products (token ${tokenNum})`);
        totalUpserted += valid.length;
      }

      await sleep(DELAY_MS);
    }
  }

  console.log('\n════════════════════════════════════');
  console.log(`Phase 1 complete`);
  console.log(`  Cosmos queries:    ${queryCount}`);
  console.log(`  Products upserted: ${totalUpserted}`);
  console.log(`  Terms skipped:     ${totalSkipped}`);
  console.log(`  Errors:            ${totalErrors}`);
  console.log('════════════════════════════════════');

  // ---------------------------------------------------------------------------
  // Phase 2: GTIN enrichment — fetch price/image/brand for products missing them
  // ---------------------------------------------------------------------------

  console.log('\n── Phase 2: GTIN enrichment ──');

  const { data: toEnrich } = await supabase
    .from('products')
    .select('id, ean, name')
    .not('ean', 'is', null)
    .is('reference_price', null)
    .limit(20); // stay within remaining daily quota

  if (!toEnrich || toEnrich.length === 0) {
    console.log('  Nothing to enrich (all products already have price data).');
  } else {
    console.log(`  ${toEnrich.length} products to enrich via /gtins/{ean}`);
    let enriched = 0;
    let enrichErrors = 0;
    consecutiveRateLimit = 0;

    for (const product of toEnrich) {
      const { token, number: tokenNum } = nextToken();

      try {
        const res = await fetch(
          `${COSMOS_BASE}/gtins/${product.ean}`,
          {
            headers: {
              'X-Cosmos-Token': token,
              'User-Agent':     'Cosmos-API-Request',
              'Content-Type':   'application/json',
            },
          }
        );

        if (!res.ok) {
          if (res.status === 429) {
            consecutiveRateLimit++;
            if (consecutiveRateLimit >= 3) {
              console.error('  3 consecutive 429s — quota exhausted. Stopping enrichment.');
              break;
            }
            console.warn(`  [${product.ean}] Rate limited — pausing 60s (${consecutiveRateLimit}/3)`);
            await sleep(60_000);
            continue;
          }
          enrichErrors++;
          continue;
        }

        consecutiveRateLimit = 0;
        const cp: CosmosProduct & { price?: string } = await res.json();

        // Parse price — /gtins returns avg_price as number and price as "R$ X,XX" string
        const avgPrice = cp.avg_price && cp.avg_price > 0 ? cp.avg_price : null;

        const updates: Record<string, unknown> = { cosmos_synced_at: new Date().toISOString() };
        if (avgPrice)        updates.reference_price = avgPrice;
        if (cp.thumbnail)    updates.image_url = cp.thumbnail;
        if (cp.brand?.name)  updates.brand = cp.brand.name;

        const { error } = await supabase
          .from('products')
          .update(updates)
          .eq('id', product.id);

        if (error) {
          console.error(`  [${product.ean}] Update error:`, error.message);
          enrichErrors++;
        } else {
          const got = [avgPrice && `price: R$${avgPrice}`, cp.thumbnail && 'image', cp.brand?.name && `brand: ${cp.brand.name}`].filter(Boolean).join(', ');
          console.log(`  [${product.name}] ✓ ${got || 'no new data'} (token ${tokenNum})`);
          enriched++;
        }
      } catch (err) {
        console.warn(`  [${product.ean}] Fetch failed:`, err);
        enrichErrors++;
      }

      await sleep(DELAY_MS);
    }

    console.log('\n════════════════════════════════════');
    console.log(`Phase 2 complete`);
    console.log(`  Products enriched: ${enriched}`);
    console.log(`  Errors:            ${enrichErrors}`);
    console.log('════════════════════════════════════');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
