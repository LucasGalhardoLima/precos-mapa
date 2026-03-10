import React from 'react';
import { PillBadge } from '../fintech/pill-badge';

interface DiscountBadgeProps {
  label: string;
  variant: 'discount' | 'highlight';
}

export function DiscountBadge({ label, variant }: DiscountBadgeProps) {
  return <PillBadge label={label} variant={variant} />;
}
