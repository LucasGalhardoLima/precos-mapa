"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";

export async function resolveQualityFlag(flagId: string) {
  await requirePermission("moderation:manage");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("price_quality_flags")
    .update({
      is_resolved: true,
      resolved_by: user?.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", flagId);

  if (error) {
    throw new Error(`Erro ao resolver flag: ${error.message}`);
  }

  revalidatePath("/painel/super/qualidade");
}
