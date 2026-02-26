import Link from "next/link";
import { BarChart3 } from "lucide-react";

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-line)] bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-primary)] text-white">
              <BarChart3 className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)] leading-tight">PrecoMapa</p>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
                Inteligencia Regional de Precos
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              href="/indice"
              className="text-sm font-medium text-[var(--color-muted)] transition hover:text-[var(--color-primary-deep)]"
            >
              Indice de Precos
            </Link>
            <Link
              href="/painel/acesso"
              className="rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
            >
              Acessar painel
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--color-line)] bg-white">
        <div className="mx-auto max-w-5xl px-5 py-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-medium text-[var(--color-ink)]">
              PrecoMapa
            </p>
            <p className="max-w-md text-xs text-[var(--color-muted)]">
              Plataforma independente de inteligencia de precos do varejo.
              Dados coletados de mercados da regiao com metodologia transparente.
            </p>
            <div className="flex gap-4 text-xs text-[var(--color-muted)]">
              <Link href="/indice" className="hover:text-[var(--color-primary-deep)]">
                Indice Regional
              </Link>
              <Link href="/privacy" className="hover:text-[var(--color-primary-deep)]">
                Privacidade
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
