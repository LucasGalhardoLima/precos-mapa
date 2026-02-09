import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { defaultSessionByRole, mockMarkets, ROLE_PERMISSIONS } from "@/features/shared/mock-data";
import { Permission, SessionContext, UserRole } from "@/features/shared/types";

export const ROLE_COOKIE_KEY = "pm_role";
export const MARKET_COOKIE_KEY = "pm_market";

const VALID_ROLES: UserRole[] = ["super_admin", "admin_mercado"];

function isUserRole(value: string | undefined): value is UserRole {
  if (!value) {
    return false;
  }
  return VALID_ROLES.includes(value as UserRole);
}

function getDefaultMarketId(role: UserRole): string {
  const defaults = defaultSessionByRole[role];
  return defaults.availableMarketIds[0] ?? mockMarkets[0].id;
}

function ensureMarketAllowed(role: UserRole, marketId: string | undefined): string {
  const defaults = defaultSessionByRole[role];
  if (marketId && defaults.availableMarketIds.includes(marketId)) {
    return marketId;
  }
  return getDefaultMarketId(role);
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get(ROLE_COOKIE_KEY)?.value;

  if (!isUserRole(roleCookie)) {
    return null;
  }

  const marketCookie = cookieStore.get(MARKET_COOKIE_KEY)?.value;
  const defaults = defaultSessionByRole[roleCookie];

  return {
    role: roleCookie,
    userName: defaults.userName,
    userEmail: defaults.userEmail,
    availableMarketIds: defaults.availableMarketIds,
    currentMarketId: ensureMarketAllowed(roleCookie, marketCookie),
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

export async function requirePermission(permission: Permission): Promise<SessionContext> {
  const session = await requireSessionContext();
  if (!hasPermission(session.role, permission)) {
    redirect("/painel/dashboard");
  }
  return session;
}
