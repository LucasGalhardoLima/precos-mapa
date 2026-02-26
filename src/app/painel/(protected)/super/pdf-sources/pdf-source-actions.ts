"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/features/auth/session";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function createPdfSource(input: {
  storeId: string;
  url: string;
  label: string;
}): Promise<{ error?: string }> {
  await requirePermission("moderation:manage");

  if (!input.storeId || !input.url) {
    return { error: "Mercado e URL sao obrigatorios." };
  }

  try {
    new URL(input.url);
  } catch {
    return { error: "URL invalida." };
  }

  const { error } = await supabaseAdmin.from("store_pdf_sources").insert({
    store_id: input.storeId,
    url: input.url,
    label: input.label || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/painel/super/pdf-sources");
  return {};
}

export async function togglePdfSource(
  sourceId: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  await requirePermission("moderation:manage");

  const { error } = await supabaseAdmin
    .from("store_pdf_sources")
    .update({ is_active: isActive })
    .eq("id", sourceId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/painel/super/pdf-sources");
  return {};
}

export async function deletePdfSource(sourceId: string): Promise<{ error?: string }> {
  await requirePermission("moderation:manage");

  const { error } = await supabaseAdmin
    .from("store_pdf_sources")
    .delete()
    .eq("id", sourceId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/painel/super/pdf-sources");
  return {};
}

export async function triggerManualImport(sourceId: string): Promise<{ error?: string }> {
  await requirePermission("moderation:manage");

  // Verify the source exists
  const { data: source, error: fetchError } = await supabaseAdmin
    .from("store_pdf_sources")
    .select("id")
    .eq("id", sourceId)
    .single();

  if (fetchError || !source) {
    return { error: "Fonte nao encontrada." };
  }

  try {
    // Delegate all work (discover PDF, hash, dedup, upload, extract) to the API route
    const cronSecret = process.env.CRON_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

    fetch(`${appUrl}/api/cron/process-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ sourceId }),
    }).catch(() => {
      // Fire-and-forget
    });

    revalidatePath("/painel/super/pdf-sources");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
