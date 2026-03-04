import React from 'react';

import { useTheme } from '../../theme/use-theme';
import { StampBadge } from '../encarte/stamp-badge';
import { PillBadge } from '../fintech/pill-badge';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DiscountBadgeProps {
  label: string;
  variant: 'discount' | 'highlight';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Themed badge that renders a `StampBadge` (encarte) or `PillBadge` (fintech)
 * depending on the active palette.
 */
export function DiscountBadge({ label, variant }: DiscountBadgeProps) {
  const { palette } = useTheme();

  if (palette === 'encarte') {
    return <StampBadge label={label} variant={variant} />;
  }

  return <PillBadge label={label} variant={variant} />;
}
