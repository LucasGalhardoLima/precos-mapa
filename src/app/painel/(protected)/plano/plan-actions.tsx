"use client";

import { useTransition } from "react";
import { createCheckoutSession, redirectToPortal } from "@/features/billing/actions";

interface PlanActionsProps {
  currentPlan: string;
  storeId: string;
  stripeCustomerId: string | null;
}

export function PlanActions({ currentPlan, storeId, stripeCustomerId }: PlanActionsProps) {
  const [isPending, startTransition] = useTransition();

  const handleUpgrade = (priceId: string) => {
    startTransition(async () => {
      await createCheckoutSession(priceId, storeId);
    });
  };

  const handleManageBilling = () => {
    if (!stripeCustomerId) return;
    startTransition(async () => {
      await redirectToPortal(stripeCustomerId);
    });
  };

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {currentPlan === "free" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID ?? "")}
          className="min-h-[44px] rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:opacity-50"
        >
          {isPending ? "Redirecionando..." : "Upgrade para Premium — 7 dias gratis"}
        </button>
      )}

      {currentPlan === "premium" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleUpgrade(process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PLUS_PRICE_ID ?? "")}
          className="min-h-[44px] rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:opacity-50"
        >
          {isPending ? "Redirecionando..." : "Upgrade para Premium+"}
        </button>
      )}

      {stripeCustomerId && (
        <button
          type="button"
          disabled={isPending}
          onClick={handleManageBilling}
          className="min-h-[44px] rounded-xl border border-[var(--color-line)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-primary)] disabled:opacity-50"
        >
          Gerenciar cobranca
        </button>
      )}
    </div>
  );
}
