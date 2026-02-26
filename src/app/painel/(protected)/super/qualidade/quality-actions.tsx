"use client";

import { useTransition } from "react";
import { resolveQualityFlag } from "./quality-server-actions";

interface QualityActionsProps {
  flagId: string;
}

export function QualityActions({ flagId }: QualityActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleResolve() {
    startTransition(async () => {
      await resolveQualityFlag(flagId);
    });
  }

  return (
    <button
      onClick={handleResolve}
      disabled={isPending}
      className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50"
    >
      {isPending ? "Resolvendo..." : "Marcar resolvida"}
    </button>
  );
}
