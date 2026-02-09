import { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
