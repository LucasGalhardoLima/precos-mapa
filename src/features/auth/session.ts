import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { ROLE_PERMISSIONS } from "@/features/shared/mock-data";
import { Permission, SessionContext, UserRole } from "@/features/shared/types";

// Service-role client bypasses RLS for server-side session checks
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function mapProfileRole(profileRole: string): UserRole | null {
  if (profileRole === "super_admin") return "super_admin";
  if (profileRole === "business") return "admin_mercado";
  return null;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Use admin client — RLS auth.uid() may not resolve with SSR cookies
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const role = mapProfileRole(profile.role);
  if (!role) return null;

  const { data: memberships } = await supabaseAdmin
    .from("store_members")
    .select("store_id")
    .eq("user_id", user.id);

  let storeIds = memberships?.map((m) => m.store_id) ?? [];

  if (role === "super_admin") {
    const { data: allStores } = await supabaseAdmin.from("stores").select("id");
    storeIds = allStores?.map((s) => s.id) ?? [];
  }

  return {
    role,
    userName: profile.display_name || user.email?.split("@")[0] || "Usuario",
    userEmail: user.email || "",
    availableMarketIds: storeIds,
    currentMarketId: storeIds[0] || "",
  };
}

export async function requireSessionContext(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) {
    redirect("/painel/acesso");
  }
  return session;
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export async function requirePermission(
  permission: Permission,
): Promise<SessionContext> {
  const session = await requireSessionContext();
  if (!hasPermission(session.role, permission)) {
    redirect("/painel/dashboard");
  }
  return session;
}
