import { redirect } from "next/navigation";
import { Building2, Crown, ShieldCheck } from "lucide-react";
import { signIn } from "@/features/auth/actions";
import { getSessionContext } from "@/features/auth/session";

export default async function PainelAcessoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSessionContext();

  if (session) {
    redirect(session.role === "super_admin" ? "/painel/super/dashboard" : "/painel/dashboard");
  }

  const params = await searchParams;
  const error = params?.error;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-5 py-16">
      <div className="grid w-full gap-8 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-3xl border border-[var(--color-line)] bg-white p-8 shadow-[var(--shadow-soft)]">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary-deep)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Acesso Administrativo
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-ink)]">Painel PrecoMapa</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
            Acesse o painel de gestao da sua loja. Gerencie ofertas, acompanhe metricas e utilize o importador IA.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <form action={signIn} className="mt-8 space-y-5">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">Email</span>
              <input
                name="email"
                type="email"
                required
                placeholder="admin@sualoja.com.br"
                className="rounded-xl border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">Senha</span>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                className="rounded-xl border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
            >
              Entrar no painel
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface-strong)] p-6">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Quem pode acessar</h2>
          <div className="mt-5 space-y-4 text-sm">
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-amber-800">
                <Crown className="h-4 w-4" />
                Super Admin
              </p>
              <p className="mt-2 text-amber-700">Visao global da plataforma, gestao de mercados, usuarios, planos e moderacao.</p>
            </article>
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 font-semibold text-emerald-800">
                <Building2 className="h-4 w-4" />
                Lojista
              </p>
              <p className="mt-2 text-emerald-700">Gestao de ofertas, performance da loja e uso do importador IA para publicacao rapida.</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
