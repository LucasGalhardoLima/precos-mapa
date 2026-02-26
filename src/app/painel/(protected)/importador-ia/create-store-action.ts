"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/features/auth/session";
import { geocodeAddress } from "@/lib/geocode";

// Service-role client bypasses RLS (same pattern as session.ts)
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface CreateStoreInput {
  name: string;
  city: string;
  state: string;
  address?: string;
}

interface CreateStoreResult {
  id: string;
  name: string;
  city: string;
  state: string;
}

export async function createStoreAction(
  input: CreateStoreInput,
): Promise<{ data?: CreateStoreResult; error?: string }> {
  // Auth check — only super_admin or importer users
  await requirePermission("importer:use");

  if (!input.name.trim()) {
    return { error: "Nome do mercado é obrigatório." };
  }

  let lat = 0;
  let lng = 0;

  // Geocode if address is provided
  if (input.address?.trim()) {
    try {
      const coords = await geocodeAddress(input.address, input.city, input.state);
      lat = coords.lat;
      lng = coords.lng;
    } catch {
      // Non-blocking: store created with (0,0) if geocoding fails from importer
    }
  }

  const { data, error } = await supabaseAdmin
    .from("stores")
    .insert({
      name: input.name.trim(),
      city: input.city.trim() || "Não informada",
      state: input.state.trim() || "SP",
      address: input.address?.trim() ?? "",
      latitude: lat,
      longitude: lng,
      logo_initial: input.name.trim().charAt(0).toUpperCase(),
      logo_color: "#6366f1",
      b2b_plan: "free",
      is_active: true,
    })
    .select("id, name, city, state")
    .single();

  if (error || !data) {
    return { error: "Erro ao criar mercado: " + (error?.message ?? "desconhecido") };
  }

  return {
    data: {
      id: data.id as string,
      name: data.name as string,
      city: data.city as string,
      state: data.state as string,
    },
  };
}
