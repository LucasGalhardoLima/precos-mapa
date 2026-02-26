"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export async function toggleOfferStatus(
  promotionId: string,
  storeId: string,
): Promise<void> {
  const supabase = await createClient();

  const { data: promotion } = await supabase
    .from("promotions")
    .select("status")
    .eq("id", promotionId)
    .eq("store_id", storeId)
    .single();

  if (!promotion) return;

  const newStatus = promotion.status === "active" ? "expired" : "active";

  await supabase
    .from("promotions")
    .update({ status: newStatus })
    .eq("id", promotionId)
    .eq("store_id", storeId);

  revalidatePath("/painel/ofertas");
}

export async function deleteOffer(
  promotionId: string,
  storeId: string,
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("promotions")
    .delete()
    .eq("id", promotionId)
    .eq("store_id", storeId);

  revalidatePath("/painel/ofertas");
}
