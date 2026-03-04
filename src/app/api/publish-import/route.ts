import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { findOrCreateProduct } from "@/lib/product-match";

interface ProductInput {
  name: string;
  price: number;
  original_price?: number;
  unit: string;
  validity: string | null;
}

interface PublishBody {
  storeId: string;
  products: ProductInput[];
  accessToken: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PublishBody;

    if (!body.accessToken) {
      return NextResponse.json({ error: "Token de acesso obrigatório." }, { status: 401 });
    }

    if (!body.storeId) {
      return NextResponse.json({ error: "ID do mercado obrigatório." }, { status: 400 });
    }

    if (!Array.isArray(body.products) || body.products.length === 0) {
      return NextResponse.json({ error: "Nenhum produto para publicar." }, { status: 400 });
    }

    // Validate JWT and get user
    const {
      data: { user },
      error: authError,
    } = await getSupabaseAdmin().auth.getUser(body.accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });
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
        const { id } = await findOrCreateProduct(getSupabaseAdmin(), {
          name: product.name,
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
