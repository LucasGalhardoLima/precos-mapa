import Link from "next/link";
import { ArrowRight, BarChart3, ShieldCheck, Smartphone, Store, TrendingUp } from "lucide-react";

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-5 py-16">
      {/* Hero */}
      <section className="w-full rounded-3xl border border-[var(--color-line)] bg-white p-8 shadow-[var(--shadow-soft)] md:p-12">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-primary)] text-white">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">PrecoMapa</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
              Inteligencia Regional de Precos
            </p>
          </div>
        </div>

        <h1 className="mt-8 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--color-ink)] md:text-5xl">
          A referencia independente de precos do varejo na sua regiao.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
          Plataforma de inteligencia de precos que coleta, analisa e publica dados reais do varejo regional.
          Indice mensal de precos, ranking de competitividade e dados abertos para consumidores, lojistas e imprensa.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/indice"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
          >
            <TrendingUp className="h-4 w-4" />
            Ver Indice de Precos
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/painel/acesso"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-white px-5 py-3 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-primary)]"
          >
            Acessar painel
          </Link>
        </div>
      </section>

      {/* Three audience CTAs */}
      <div className="mt-8 grid w-full gap-4 md:grid-cols-3">
        <Link
          href="/indice"
          className="group rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)] transition hover:border-[var(--color-primary)]"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
            <Smartphone className="h-4 w-4 text-[var(--color-primary)]" />
            Para Consumidores
          </div>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Descubra onde comprar mais barato na sua cidade. Compare precos reais entre mercados e economize no dia a dia.
          </p>
          <p className="mt-3 text-xs font-semibold text-[var(--color-primary)] transition group-hover:underline">
            Baixar app gratuito →
          </p>
        </Link>

        <Link
          href="/painel/acesso"
          className="group rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)] transition hover:border-[var(--color-primary)]"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
            <Store className="h-4 w-4 text-[var(--color-primary)]" />
            Para Lojistas
          </div>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Inteligencia estrategica baseada no indice oficial da regiao. Saiba como seus precos se comparam ao mercado.
          </p>
          <p className="mt-3 text-xs font-semibold text-[var(--color-primary)] transition group-hover:underline">
            Conhecer planos →
          </p>
        </Link>

        <Link
          href="/indice"
          className="group rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)] transition hover:border-[var(--color-primary)]"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
            <BarChart3 className="h-4 w-4 text-[var(--color-primary)]" />
            Dados Publicos
          </div>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Indice Regional de Precos do Varejo publicado mensalmente. Dados abertos com metodologia transparente para imprensa e pesquisa.
          </p>
          <p className="mt-3 text-xs font-semibold text-[var(--color-primary)] transition group-hover:underline">
            Acessar indice →
          </p>
        </Link>
      </div>

      {/* Trust bar */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--color-muted)]">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Plataforma independente
        </div>
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" />
          Metodologia transparente
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Dados reais do varejo
        </div>
      </div>
    </div>
  );
}
