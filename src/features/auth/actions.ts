"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { defaultSessionByRole, mockMarkets } from "@/features/shared/mock-data";
import { UserRole } from "@/features/shared/types";
import { MARKET_COOKIE_KEY, ROLE_COOKIE_KEY } from "@/features/auth/session";

const RoleSchema = z.enum(["super_admin", "admin_mercado"]);
const MarketSchema = z.string().min(1);

function parseRole(value: FormDataEntryValue | null): UserRole {
  const parsed = RoleSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return "admin_mercado";
}

function parseMarket(role: UserRole, marketValue: FormDataEntryValue | null): string {
  const allowed = defaultSessionByRole[role].availableMarketIds;
  const parsed = MarketSchema.safeParse(marketValue);

  if (parsed.success && allowed.includes(parsed.data)) {
    return parsed.data;
  }

  return allowed[0] ?? mockMarkets[0].id;
}

export async function startMockSession(formData: FormData): Promise<void> {
  const role = parseRole(formData.get("role"));
  const marketId = parseMarket(role, formData.get("marketId"));

  const cookieStore = await cookies();
  cookieStore.set(ROLE_COOKIE_KEY, role, { path: "/", sameSite: "lax", httpOnly: false });
  cookieStore.set(MARKET_COOKIE_KEY, marketId, { path: "/", sameSite: "lax", httpOnly: false });

  redirect(role === "super_admin" ? "/painel/super/dashboard" : "/painel/dashboard");
}

export async function switchRole(formData: FormData): Promise<void> {
  const role = parseRole(formData.get("role"));
  const marketId = parseMarket(role, formData.get("marketId"));

  const cookieStore = await cookies();
  cookieStore.set(ROLE_COOKIE_KEY, role, { path: "/", sameSite: "lax", httpOnly: false });
  cookieStore.set(MARKET_COOKIE_KEY, marketId, { path: "/", sameSite: "lax", httpOnly: false });

  revalidatePath("/painel");
  redirect(role === "super_admin" ? "/painel/super/dashboard" : "/painel/dashboard");
}

export async function switchMarketContext(formData: FormData): Promise<void> {
  const role = parseRole(formData.get("role"));
  const marketId = parseMarket(role, formData.get("marketId"));

  const cookieStore = await cookies();
  cookieStore.set(MARKET_COOKIE_KEY, marketId, { path: "/", sameSite: "lax", httpOnly: false });

  revalidatePath("/painel");
}

export async function endMockSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ROLE_COOKIE_KEY);
  cookieStore.delete(MARKET_COOKIE_KEY);

  redirect("/painel/acesso");
}
