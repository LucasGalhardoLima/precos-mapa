/**
 * DB access seam for scraper scripts (scripts/scrape-*-prices.ts): one
 * interface, two transports.
 *
 * REST (createRestScraperDb) wraps supabase-js exactly as every scraper
 * always has — same calls, same behavior, only pulled out behind this
 * interface so the direct alternative below can stand in for it.
 *
 * Direct (createDirectScraperDb) is the bridge for when PostgREST itself is
 * unreachable (2026-09: project restricted on the Storage files quota,
 * which also 402s every REST call, reads included — see
 * docs/poup-fase2-analysis.md's neighbors for context). It talks to Postgres
 * directly via `pg`, bypassing the Data API entirely. Selected by the
 * caller based on whether SCRAPER_DATABASE_URL is set; nothing in here
 * decides that — see scripts/scrape-jauserve-prices.ts.
 *
 * Every write here (products/store_prices/promotions) is gated by RLS
 * policies scoped to business users or to `auth.role() = 'service_role'`
 * (see migrations 001/021/030) — the same as what SUPABASE_SERVICE_ROLE_KEY
 * satisfies over REST. A raw Postgres login has no JWT and so no
 * `auth.role()`, so this issues `SET ROLE service_role` on every new
 * connection: `service_role` is the one Postgres role with BYPASSRLS set
 * (verified live, 2026-09-22), which is what actually makes the existing
 * REST path able to write today, not the auth.role() check passing. Whatever
 * role SCRAPER_DATABASE_URL logs in as must be a member of service_role —
 * `GRANT service_role TO <that role>;` — nothing more (no per-table grants
 * needed: once the session is service_role, its own existing grants apply).
 * Never hand out `postgres` itself for this — full superuser is far broader
 * than the job needs.
 *
 * Takes a single already-connected `pg.Client`, not a `Pool`: this scraper
 * processes one product at a time (no concurrent queries), and a `Pool`'s
 * 'connect' event isn't awaited by pg-pool before handing the connection to
 * a caller's query — running SET ROLE there would race the first real query
 * on a fresh connection. Call `connectAsServiceRole()` below to get a client
 * that's already past that step.
 *
 * Decision logic (brand/EAN/size compatibility, size parsing) lives once in
 * product-match.ts and is reused unchanged by both transports below — only
 * the I/O (RPC calls, inserts, updates) differs. The SQL here is a literal
 * translation of product-match.ts's/crawler-promotions.ts's existing
 * supabase-js calls, verified column-for-column against the RPCs' current
 * definitions (migrations 065, 070) — not reinvented.
 *
 * shortcut: the direct path skips enrichProductFromCosmos (best-effort,
 * fire-and-forget HTTP enrichment, unrelated to price freshness) — upgrade:
 * route it through updateProductIfNull too if that gap turns out to matter
 * while running in direct mode for longer than a short bridge.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client } from 'pg';
import {
  findOrCreateProduct as findOrCreateProductRest,
  isBrandCompatible,
  isEanCompatible,
  extractSize,
  looksLikeProduce,
  type FindOrCreateInput,
  type FindOrCreateResult,
} from './product-match';
import { parseProductSize } from './parse-product-size';
import {
  syncCrawlerPromotion as syncCrawlerPromotionRest,
  type SyncCrawlerPromotionInput,
} from './crawler-promotions';

export type { FindOrCreateInput, FindOrCreateResult, SyncCrawlerPromotionInput };

export interface StorePriceRow {
  productId: string;
  storeId: string;
  price: number;
  isPromo: boolean;
  source: string;
  confidence: number;
  validUntil: string | null;
}

export interface ScraperDb {
  getStoreIdByName(namePattern: string): Promise<{ id: string; name: string } | null>;
  findProductByEan(ean: string): Promise<{ id: string } | null>;
  findOrCreateProduct(input: FindOrCreateInput): Promise<FindOrCreateResult>;
  /** Sets `column` on `productId` only when it is currently NULL — same guarded-once convention every scraper already uses for ean/image_url. */
  updateProductIfNull(productId: string, column: 'ean' | 'image_url', value: string): Promise<void>;
  upsertStorePrice(row: StorePriceRow): Promise<void>;
  syncCrawlerPromotion(input: SyncCrawlerPromotionInput): Promise<void>;
}

// ─────────────────────────── REST (unchanged behavior) ───────────────────────────

export function createRestScraperDb(supabase: SupabaseClient): ScraperDb {
  return {
    async getStoreIdByName(namePattern) {
      const { data } = await supabase
        .from('stores')
        .select('id, name')
        .ilike('name', namePattern)
        .eq('is_active', true)
        .maybeSingle();
      return data ?? null;
    },

    async findProductByEan(ean) {
      const { data } = await supabase.from('products').select('id').eq('ean', ean).maybeSingle();
      return data ?? null;
    },

    findOrCreateProduct: (input) => findOrCreateProductRest(supabase, input),

    async updateProductIfNull(productId, column, value) {
      await supabase.from('products').update({ [column]: value }).eq('id', productId).is(column, null);
    },

    async upsertStorePrice(row) {
      const { error } = await supabase.from('store_prices').upsert(
        {
          product_id: row.productId,
          store_id: row.storeId,
          price: row.price,
          is_promo: row.isPromo,
          source: row.source,
          confidence: row.confidence,
          valid_until: row.validUntil,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'product_id,store_id' },
      );
      if (error) console.warn(`  [store_prices upsert failed] ${row.productId}/${row.storeId}: ${error.message}`);
    },

    syncCrawlerPromotion: (input) => syncCrawlerPromotionRest(supabase, input),
  };
}

// ─────────────────────────── Direct (bridge) ───────────────────────────

interface MatchCandidate {
  id: string;
  name: string;
  brand: string | null;
  ean: string | null;
  match_type?: string;
  match_score?: number;
  confidence?: number;
}

/**
 * Connects and switches to service_role before returning, so every query
 * the caller issues afterward is already past that step — no ordering race
 * with whatever query runs first. Throws (with the SET ROLE error message
 * intact) if the connecting role isn't a member of service_role.
 */
export async function connectAsServiceRole(connectionString: string): Promise<Client> {
  const { Client: PgClient } = await import('pg');
  const client = new PgClient({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('SET ROLE service_role');
  } catch (err) {
    await client.end();
    throw new Error(
      `SET ROLE service_role failed — the SCRAPER_DATABASE_URL role needs 'GRANT service_role TO <role>;': ${err instanceof Error ? err.message : err}`,
    );
  }
  return client;
}

export function createDirectScraperDb(client: Client): ScraperDb {
  async function findOrCreateProductDirect(input: FindOrCreateInput): Promise<FindOrCreateResult> {
    const normalizedName = input.name.trim().replace(/\s+/g, ' ');
    const inputSize = extractSize(normalizedName);
    const isProduce = !input.ean && (input.categoryId === 'cat_hortifruti' || looksLikeProduce(normalizedName));

    // 0. Produce exact-match RPC — mirrors product-match.ts step 0.
    if (input.strictNoEanMatch && isProduce) {
      const { rows } = await client.query<MatchCandidate>('select * from find_produce_exact_match($1)', [normalizedName]);
      for (const match of rows) {
        if (!isBrandCompatible(input.brand, match.brand)) continue;
        return { id: match.id, matched: true, confidence: 0.9, isNew: false };
      }
    }

    // 1-2. Fuzzy/synonym match RPC — mirrors product-match.ts steps 1-2.
    const { rows: candidates } = await client.query<MatchCandidate>(
      'select * from match_product_for_upsert($1, $2, $3, $4)',
      [normalizedName, input.brand ?? null, input.categoryId ?? null, inputSize],
    );

    for (const match of candidates) {
      if (match.match_type === 'synonym') {
        return { id: match.id, matched: true, confidence: 1.0, isNew: false };
      }
      if (!isBrandCompatible(input.brand, match.brand)) continue;
      if (!isEanCompatible(input.ean, match.ean)) continue;
      if (input.strictNoEanMatch && !input.ean) {
        const candidateNormalized = match.name.trim().replace(/\s+/g, ' ').toLowerCase();
        if (candidateNormalized !== normalizedName.toLowerCase()) continue;
      }
      const matchSize = extractSize(match.name);
      const sizesCompatible = !inputSize || !matchSize || inputSize === matchSize;
      if (sizesCompatible) {
        return { id: match.id, matched: true, confidence: match.confidence ?? match.match_score ?? 0, isNew: false };
      }
    }

    // 3. No match — create new product. Mirrors product-match.ts step 3,
    // including its 23505-race fallback (whatever constraint trips it —
    // this doesn't need to know which, only to react the same way).
    const size = parseProductSize(normalizedName);
    const categoryId = input.categoryId ?? (isProduce ? 'cat_hortifruti' : 'cat_alimentos');
    try {
      const { rows } = await client.query<{ id: string }>(
        `insert into products (name, category_id, brand, reference_price, size_value, size_unit)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [normalizedName, categoryId, input.brand ?? null, input.referencePrice, size?.value ?? null, size?.unit ?? null],
      );
      return { id: rows[0].id, matched: false, confidence: 1.0, isNew: true };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === '23505') {
        const { rows } = await client.query<{ id: string }>('select id from products where name = $1 limit 1', [normalizedName]);
        if (rows[0]) return { id: rows[0].id, matched: true, confidence: 0.95, isNew: false };
      }
      throw new Error(`Erro ao criar produto: ${err instanceof Error ? err.message : err}`);
    }
    // Cosmos enrichment intentionally skipped here — see file header.
  }

  return {
    async getStoreIdByName(namePattern) {
      const { rows } = await client.query<{ id: string; name: string }>(
        'select id, name from stores where name ilike $1 and is_active = true limit 1',
        [namePattern],
      );
      return rows[0] ?? null;
    },

    async findProductByEan(ean) {
      const { rows } = await client.query<{ id: string }>('select id from products where ean = $1 limit 1', [ean]);
      return rows[0] ?? null;
    },

    findOrCreateProduct: findOrCreateProductDirect,

    async updateProductIfNull(productId, column, value) {
      // `column` is a TS union of two literal identifiers, never external
      // input, so string-interpolating it into the statement is safe.
      await client.query(`update products set ${column} = $1 where id = $2 and ${column} is null`, [value, productId]);
    },

    async upsertStorePrice(row) {
      try {
        await client.query(
          `insert into store_prices (product_id, store_id, price, is_promo, source, confidence, valid_until, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (product_id, store_id) do update set
             price = excluded.price, is_promo = excluded.is_promo, source = excluded.source,
             confidence = excluded.confidence, valid_until = excluded.valid_until, updated_at = excluded.updated_at`,
          [row.productId, row.storeId, row.price, row.isPromo, row.source, row.confidence, row.validUntil, new Date().toISOString()],
        );
      } catch (err) {
        console.warn(`  [store_prices upsert failed] ${row.productId}/${row.storeId}: ${err instanceof Error ? err.message : err}`);
      }
    },

    async syncCrawlerPromotion(input) {
      const ROLLING_WINDOW_DAYS = 3; // mirrors crawler-promotions.ts's constant
      const endDate = new Date(Date.now() + ROLLING_WINDOW_DAYS * 86_400_000).toISOString();

      const { rows } = await client.query<{ id: string }>(
        `select id from promotions where product_id = $1 and store_id = $2 and source = 'crawler' and status = 'active' limit 1`,
        [input.productId, input.storeId],
      );

      if (rows[0]) {
        await client.query(
          'update promotions set original_price = $1, promo_price = $2, end_date = $3, updated_at = $4 where id = $5',
          [input.originalPrice, input.promoPrice, endDate, new Date().toISOString(), rows[0].id],
        );
      } else {
        await client.query(
          `insert into promotions (product_id, store_id, original_price, promo_price, start_date, end_date, status, source, verified)
           values ($1, $2, $3, $4, $5, $6, 'active', 'crawler', true)`,
          [input.productId, input.storeId, input.originalPrice, input.promoPrice, new Date().toISOString(), endDate],
        );
      }
    },
  };
}
