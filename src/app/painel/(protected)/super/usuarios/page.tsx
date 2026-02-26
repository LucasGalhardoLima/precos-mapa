import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  business: "Mercado",
};

export default async function SuperUsersPage() {
  await requirePermission("user:manage");
  const supabase = await createClient();

  // Service-role client to access auth.users emails
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch platform users (super_admin + business only)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, role, created_at, updated_at")
    .in("role", ["super_admin", "business"])
    .order("created_at", { ascending: false });

  // Fetch auth users for emails
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map<string, string>();
  for (const u of authData?.users ?? []) {
    if (u.email) emailMap.set(u.id, u.email);
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const users = (profiles ?? []).map((p) => {
    const isActive = p.updated_at && p.updated_at >= thirtyDaysAgo;
    return {
      id: p.id as string,
      name: (p.display_name as string) || "—",
      email: emailMap.get(p.id as string) ?? "—",
      role: ROLE_LABELS[p.role as string] ?? (p.role as string),
      status: isActive ? ("ativo" as const) : ("inativo" as const),
      lastAccess: p.updated_at
        ? new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(p.updated_at as string))
        : "—",
    };
  });

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Usuários da plataforma"
        subtitle="Controle de acesso para equipe interna e mercados."
      />

      {users.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--color-muted)]">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {users.map((user) => (
            <article key={user.id} className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
              <p className="text-lg font-semibold text-[var(--color-ink)]">{user.name}</p>
              <p className="text-sm text-[var(--color-muted)]">{user.email}</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-[var(--color-surface-strong)] px-2 py-1 text-xs font-medium text-[var(--color-muted)]">
                  {user.role}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    user.status === "ativo" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {user.status}
                </span>
              </div>
              <p className="mt-3 text-xs text-[var(--color-muted)]">Último acesso: {user.lastAccess}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
