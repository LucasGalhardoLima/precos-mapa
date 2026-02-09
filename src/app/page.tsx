import Link from "next/link";
import { ArrowRight, ShieldCheck, Smartphone, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-16">
      <div className="grid w-full gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-[var(--color-line)] bg-white p-8 shadow-[var(--shadow-soft)]">
          <p className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-primary-deep)]">
            <Sparkles className="h-3.5 w-3.5" />
            PreçoMapa Demo 2026
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--color-ink)]">
            Produto único para mercados e operação global.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
            Painel com RBAC para super admin e admin mercado, importador IA de encartes com revisão humana, e app
            mobile Expo com telas core para busca, comparação e alertas.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/painel/acesso"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
            >
              Abrir painel
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/painel/importador-ia"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)]"
            >
              Ver importador IA
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          <article className="rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)]">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
              <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" />
              RBAC pronto para demo
            </p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              `super_admin` com visão global + troca de contexto e `admin_mercado` com operação local.
            </p>
          </article>

          <article className="rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)]">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
              <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
              Importador IA integrado
            </p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              URL/PDF com processamento real quando disponível e fallback mock para segurança de apresentação.
            </p>
          </article>

          <article className="rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)]">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
              <Smartphone className="h-4 w-4 text-[var(--color-primary)]" />
              App Expo no repositório
            </p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Estrutura pronta para iOS e Android com 5 telas core totalmente mockadas.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}
