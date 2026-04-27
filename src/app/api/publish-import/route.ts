import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { findOrCreateProduct } from "@/lib/product-match";
import { extractBrand, normalizeCategory } from "@/lib/schemas";
import { requireApiAuth } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

interface ProductInput {
  name: string;
  price: number;
  original_price?: number;
  unit: string;
  validity: string | null;
  category?: string;
  brand?: string;
}

interface PublishBody {
  storeId: string;
  products: ProductInput[];
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await requireApiAuth(request);
    if (authError) return authError;

    const ip = getClientIp(request);
    if (!checkRateLimit(`publish:${ip}:${user.id}`, 10, 60_000)) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em instantes." },
        { status: 429 },
      );
    }

    const body = (await request.json()) as PublishBody;

    if (!body.storeId) {
      return NextResponse.json({ error: "ID do mercado obrigatório." }, { status: 400 });
    }

    if (!Array.isArray(body.products) || body.products.length === 0) {
      return NextResponse.json({ error: "Nenhum produto para publicar." }, { status: 400 });
    }

    // Verify user is a member of the store
    const { data: member } = await getSupabaseAdmin()
      .from("store_members")
      .select("store_id")
      .eq("user_id", user.id)
      .eq("store_id", body.storeId)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        { error: "Você não é membro deste mercado." },
        { status: 403 },
      );
    }

    // Ensure default category exists
    const DEFAULT_CAT_ID = "cat_alimentos";
    const { data: catCheck } = await getSupabaseAdmin()
      .from("categories")
      .select("id")
      .eq("id", DEFAULT_CAT_ID)
      .maybeSingle();

    if (!catCheck) {
      await getSupabaseAdmin().from("categories").insert({
        id: DEFAULT_CAT_ID,
        name: "Alimentos",
        icon: "wheat",
        sort_order: 0,
      });
    }

    const now = new Date().toISOString();
    let published = 0;
    const errors: string[] = [];

    for (const product of body.products) {
      let productId: string;

      try {
        const brand = product.brand ?? extractBrand(product.name) ?? undefined;
        const categoryId = product.category
          ? normalizeCategory(product.category)
          : undefined;
        const { id } = await findOrCreateProduct(getSupabaseAdmin(), {
          name: product.name,
          categoryId,
          brand,
          referencePrice: product.original_price ?? product.price,
        });
        productId = id;
      } catch (err) {
        errors.push(
          `Produto "${product.name}": ${err instanceof Error ? err.message : "erro desconhecido"}`,
        );
        continue;
      }

      let endDate: string;
      if (product.validity) {
        endDate = new Date(product.validity + "T23:59:59Z").toISOString();
      } else {
        const future = new Date();
        future.setDate(future.getDate() + 7);
        endDate = future.toISOString();
      }

      const originalPrice = product.original_price ?? product.price;

      const { error: promoError } = await getSupabaseAdmin().from("promotions").insert({
        store_id: body.storeId,
        product_id: productId,
        original_price: originalPrice,
        promo_price: product.price,
        start_date: now,
        end_date: endDate,
        source: "importador_ia",
        status: "active",
        created_by: user.id,
      });

      if (promoError) {
        errors.push(`Promoção "${product.name}": ${promoError.message}`);
        continue;
      }

      // Dual-write current price to store_prices (ERP-ready price layer)
      // store_prices upsert failure is non-fatal
      const { error: priceError } = await getSupabaseAdmin()
        .from('store_prices')
        .upsert(
          {
            product_id:  productId,
            store_id:    body.storeId,
            price:       product.price,
            is_promo:    (product.original_price ?? product.price) > product.price,
            source:      'pdf_import',
            valid_until: endDate,
            updated_at:  now,
          },
          { onConflict: 'product_id,store_id' }
        );
      if (priceError) console.error('[publish-import] store_prices upsert failed:', priceError.message);

      published++;
    }

    if (published === 0 && errors.length > 0) {
      return NextResponse.json(
        { count: 0, error: `Falha ao publicar. ${errors[0]}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      count: published,
      ...(errors.length > 0
        ? { error: `${published} publicadas, ${errors.length} falharam. ${errors[0]}` }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
