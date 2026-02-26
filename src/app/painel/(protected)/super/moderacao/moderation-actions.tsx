"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { approvePromotion, rejectPromotion } from "./moderation-server-actions";

export function ModerationActions({ promotionId }: { promotionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      await approvePromotion(promotionId);
      router.refresh();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      await rejectPromotion(promotionId);
      router.refresh();
    });
  };

  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={handleApprove}
        className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        Aprovar
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={handleReject}
        className="min-h-[44px] rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
      >
        Rejeitar
      </button>
    </div>
  );
}
