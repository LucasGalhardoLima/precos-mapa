import { SectionHeader } from "@/features/panel/components/section-header";
import { mockPlatformUsers } from "@/features/shared/mock-data";

export default function SuperUsersPage() {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Usuários da plataforma"
        subtitle="Controle de acesso para equipe interna (super admin, analistas e suporte)."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {mockPlatformUsers.map((user) => (
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
    </div>
  );
}
