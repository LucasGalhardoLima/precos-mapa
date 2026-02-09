"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useRef } from "react";
import {
  BarChart3,
  Building2,
  Crown,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Tags,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";
import { endMockSession, switchMarketContext, switchRole } from "@/features/auth/actions";
import { MarketSummary, SessionContext } from "@/features/shared/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface PanelShellProps {
  session: SessionContext;
  markets: MarketSummary[];
  children: React.ReactNode;
}

const marketNavItems: NavItem[] = [
  { href: "/painel/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/painel/ofertas", label: "Minhas Ofertas", icon: Tags },
  { href: "/painel/ofertas/nova", label: "Criar Oferta", icon: Sparkles },
  { href: "/painel/importador-ia", label: "Importador IA", icon: ShieldCheck },
  { href: "/painel/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/painel/plano", label: "Plano", icon: Wallet },
];

const superNavItems: NavItem[] = [
  { href: "/painel/super/dashboard", label: "Visão Global", icon: Crown },
  { href: "/painel/super/mercados", label: "Mercados", icon: Building2 },
  { href: "/painel/super/usuarios", label: "Usuários", icon: Users },
  { href: "/painel/super/planos", label: "Planos", icon: Wallet },
  { href: "/painel/super/moderacao", label: "Moderação", icon: ShieldCheck },
];

function isActiveRoute(pathname: string, href: string): boolean {
  if (pathname === href) {
    return true;
  }
  if (href === "/painel/dashboard") {
    return pathname.startsWith("/painel/dashboard");
  }
  return pathname.startsWith(`${href}/`);
}

export function PanelShell({ session, markets, children }: PanelShellProps) {
  const pathname = usePathname();
  const marketFormRef = useRef<HTMLFormElement>(null);
  const roleFormRef = useRef<HTMLFormElement>(null);

  const currentMarket = markets.find((market) => market.id === session.currentMarketId) ?? markets[0];

  const allowedMarkets = useMemo(() => {
    return markets.filter((market) => session.availableMarketIds.includes(market.id));
  }, [markets, session.availableMarketIds]);

  const visibleNav = session.role === "super_admin" ? [...superNavItems, ...marketNavItems] : marketNavItems;

  return (
    <div className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <div className="mx-auto flex w-full max-w-[1500px] gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-[280px] shrink-0 rounded-3xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)] lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--color-primary)] text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">Painel Único</p>
              <p className="text-xl font-semibold">PreçoMapa</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = isActiveRoute(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary-deep)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-strong)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <form action={endMockSession} className="mt-8">
            <button
              type="submit"
              className="w-full rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-deep)]"
            >
              Encerrar sessão mock
            </button>
          </form>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="rounded-3xl border border-[var(--color-line)] bg-white px-5 py-4 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <UserCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--color-ink)]">{session.userName}</p>
                  <p className="truncate text-xs text-[var(--color-muted)]">{session.userEmail}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    session.role === "super_admin"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {session.role === "super_admin" ? "Super Admin" : "Admin Mercado"}
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <form ref={roleFormRef} action={switchRole} className="grid gap-1.5">
                  <label className="text-xs font-medium text-[var(--color-muted)]" htmlFor="role-switcher">
                    Perfil da sessão
                  </label>
                  <input name="marketId" value={session.currentMarketId} readOnly className="hidden" />
                  <select
                    id="role-switcher"
                    name="role"
                    defaultValue={session.role}
                    className="rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                    onChange={() => roleFormRef.current?.requestSubmit()}
                  >
                    <option value="admin_mercado">Admin Mercado</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </form>

                <form ref={marketFormRef} action={switchMarketContext} className="grid gap-1.5">
                  <label className="text-xs font-medium text-[var(--color-muted)]" htmlFor="market-switcher">
                    Mercado ativo
                  </label>
                  <input name="role" value={session.role} readOnly className="hidden" />
                  <select
                    id="market-switcher"
                    name="marketId"
                    defaultValue={session.currentMarketId}
                    className="rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                    onChange={() => marketFormRef.current?.requestSubmit()}
                  >
                    {allowedMarkets.map((market) => (
                      <option key={market.id} value={market.id}>
                        {market.name} ({market.city}/{market.state})
                      </option>
                    ))}
                  </select>
                </form>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-[var(--color-surface-strong)] px-4 py-3 text-sm text-[var(--color-muted)]">
              Contexto atual: <strong className="text-[var(--color-ink)]">{currentMarket.name}</strong>. Super admin pode alternar de mercado sem sair do painel.
            </div>

            <div className="mt-4 lg:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {visibleNav.map((item) => {
                  const active = isActiveRoute(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-deep)]"
                          : "border-[var(--color-line)] text-[var(--color-muted)]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <form action={endMockSession} className="mt-3">
                <button
                  type="submit"
                  className="w-full rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-deep)]"
                >
                  Encerrar sessão mock
                </button>
              </form>
            </div>
          </header>

          <main className="min-h-[70vh]">{children}</main>
        </div>
      </div>
    </div>
  );
}
