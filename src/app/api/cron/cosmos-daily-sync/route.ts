import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const COSMOS_BASE = "https://api.cosmos.bluesoft.com.br";

function validateCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function getTokens(): string[] {
  return [
    process.env.COSMOS_API_TOKEN,
    process.env.COSMOS_API_TOKEN_2,
    process.env.COSMOS_API_TOKEN_3,
    process.env.COSMOS_API_TOKEN_4,
  ].filter(Boolean) as string[];
}

interface CosmosProduct {
  gtin: string | number;
  description: string;
  brand?: { name: string };
  thumbnail?: string;
  avg_price?: number;
}

async function fetchFromCosmos(dateStr: string, tokens: string[]): Promise<Response> {
  for (const token of tokens) {
    const res = await fetch(`${COSMOS_BASE}/products/by_date?date=${encodeURIComponent(dateStr)}`, {
      headers: {
        "X-Cosmos-Token": token,
        "User-Agent": "Cosmos-API-Request",
        "Content-Type": "application/json",
      },
    });
    if (res.status === 429) {
      console.warn(`[cosmos-daily-sync] Token exhausted (429), trying next`);
      continue;
    }
    return res;
  }
  throw new Error("All Cosmos tokens exhausted");
}

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = getTokens();
  if (tokens.length === 0) {
    return NextResponse.json({ error: "No COSMOS_API_TOKEN set" }, { status: 500 });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  let res: Response;
  try {
    res = await fetchFromCosmos(dateStr, tokens);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cosmos-daily-sync] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!res.ok) {
    console.error(`[cosmos-daily-sync] Cosmos error ${res.status}`);
    return NextResponse.json({ error: `Cosmos error ${res.status}` }, { status: 500 });
  }

  const data = await res.json();
  const products: CosmosProduct[] = Array.isArray(data)
    ? data
    : ((data as { products?: CosmosProduct[] }).products ?? []);

  const supabase = getSupabaseAdmin();
  let updated = 0;
  let skipped = 0;

  for (const cp of products) {
    if (!cp.gtin || cp.gtin === 0) { skipped++; continue; }
    if (!cp.avg_price || cp.avg_price <= 0) { skipped++; continue; }
    if (!cp.description) { skipped++; continue; }

    const { error } = await supabase.from("products").upsert(
      {
        ean: String(cp.gtin),
        name: toTitleCase(cp.description),
        brand: cp.brand?.name ?? null,
        image_url: cp.thumbnail ?? null,
        reference_price: cp.avg_price,
        cosmos_synced_at: new Date().toISOString(),
      },
      { onConflict: "ean", ignoreDuplicates: false },
    );

    if (error) {
      console.error(`[cosmos-daily-sync] upsert failed ean=${cp.gtin}: ${error.message}`);
    } else {
      updated++;
    }
  }

  console.log(`[cosmos-daily-sync] date=${dateStr} total=${products.length} updated=${updated} skipped=${skipped}`);

  return NextResponse.json({ date: dateStr, total: products.length, updated, skipped });
}
