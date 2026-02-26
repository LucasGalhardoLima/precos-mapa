"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";

export async function approvePromotion(promotionId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("promotions")
    .update({ status: "active", is_verified: true })
    .eq("id", promotionId);

  revalidatePath("/painel/super/moderacao");
}

export async function rejectPromotion(promotionId: string): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("promotions")
    .update({ status: "expired" })
    .eq("id", promotionId);

  revalidatePath("/painel/super/moderacao");
}
