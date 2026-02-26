"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/features/auth/session";
import { geocodeAddress } from "@/lib/geocode";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface CreateStoreInput {
  name: string;
  address: string;
  city: string;
  state: string;
}

interface UpdateStoreInput {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  is_active: boolean;
  b2b_plan: string;
}

interface DeleteStoreInput {
  id: string;
}

export async function createStoreAction(
  input: CreateStoreInput,
): Promise<{ error?: string }> {
  await requirePermission("market:manage");

  if (!input.name.trim()) {
    return { error: "Nome do mercado e obrigatorio." };
  }

  if (!input.address.trim()) {
    return { error: "Endereco e obrigatorio para geocodificacao." };
  }

  let lat = 0;
  let lng = 0;

  try {
    const coords = await geocodeAddress(input.address, input.city, input.state);
    lat = coords.lat;
    lng = coords.lng;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao geocodificar endereco." };
  }

  const { error } = await supabaseAdmin.from("stores").insert({
    name: input.name.trim(),
    address: input.address.trim(),
    city: input.city.trim() || "Nao informada",
    state: input.state.trim() || "SP",
    latitude: lat,
    longitude: lng,
    logo_initial: input.name.trim().charAt(0).toUpperCase(),
    logo_color: "#6366f1",
    b2b_plan: "free",
    is_active: true,
  });

  if (error) {
    return { error: `Erro ao criar mercado: ${error.message}` };
  }

  revalidatePath("/painel/super/mercados");
  return {};
}

export async function updateStoreAction(
  input: UpdateStoreInput,
): Promise<{ error?: string }> {
  await requirePermission("market:manage");

  if (!input.name.trim()) {
    return { error: "Nome do mercado e obrigatorio." };
  }

  // Check if address changed — re-geocode if so
  const { data: existing } = await supabaseAdmin
    .from("stores")
    .select("address, city, state")
    .eq("id", input.id)
    .single();

  let lat: number | undefined;
  let lng: number | undefined;

  const addressChanged =
    existing &&
    (existing.address !== input.address.trim() ||
      existing.city !== input.city.trim() ||
      existing.state !== input.state.trim());

  if (addressChanged && input.address.trim()) {
    try {
      const coords = await geocodeAddress(input.address, input.city, input.state);
      lat = coords.lat;
      lng = coords.lng;
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Erro ao geocodificar endereco." };
    }
  }

  const updatePayload: Record<string, unknown> = {
    name: input.name.trim(),
    address: input.address.trim(),
    city: input.city.trim() || "Nao informada",
    state: input.state.trim() || "SP",
    is_active: input.is_active,
    b2b_plan: input.b2b_plan,
  };

  if (lat !== undefined && lng !== undefined) {
    updatePayload.latitude = lat;
    updatePayload.longitude = lng;
  }

  const { error } = await supabaseAdmin
    .from("stores")
    .update(updatePayload)
    .eq("id", input.id);

  if (error) {
    return { error: `Erro ao atualizar mercado: ${error.message}` };
  }

  revalidatePath("/painel/super/mercados");
  return {};
}

export async function deleteStoreAction(
  input: DeleteStoreInput,
): Promise<{ error?: string }> {
  await requirePermission("market:manage");

  // Check if store has promotions — soft-delete if so
  const { count } = await supabaseAdmin
    .from("promotions")
    .select("*", { count: "exact", head: true })
    .eq("store_id", input.id);

  if (count && count > 0) {
    // Soft-delete: set is_active = false
    const { error } = await supabaseAdmin
      .from("stores")
      .update({ is_active: false })
      .eq("id", input.id);

    if (error) {
      return { error: `Erro ao desativar mercado: ${error.message}` };
    }
  } else {
    // Hard-delete: no promotions
    const { error } = await supabaseAdmin
      .from("stores")
      .delete()
      .eq("id", input.id);

    if (error) {
      return { error: `Erro ao excluir mercado: ${error.message}` };
    }
  }

  revalidatePath("/painel/super/mercados");
  return {};
}
