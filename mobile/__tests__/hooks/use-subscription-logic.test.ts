// mobile/__tests__/hooks/use-subscription-logic.test.ts

// Replicate the entitlement-to-plan mapping from use-subscription.ts

type B2CPlan = 'free' | 'plus' | 'family';

interface CustomerInfo {
  entitlements: {
    active: Record<string, unknown>;
  };
}

function mapEntitlementsToPlan(info: CustomerInfo): B2CPlan {
  if (info.entitlements.active['family']) return 'family';
  if (info.entitlements.active['plus']) return 'plus';
  return 'free';
}

function derivePlanFlags(plan: B2CPlan) {
  return {
    isPlus: plan === 'plus' || plan === 'family',
    isFamily: plan === 'family',
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Subscription — mapEntitlementsToPlan', () => {
  it('returns "family" when family entitlement is active', () => {
    const info: CustomerInfo = {
      entitlements: {
        active: { family: { identifier: 'family' } },
      },
    };

    expect(mapEntitlementsToPlan(info)).toBe('family');
  });

  it('returns "plus" when plus entitlement is active', () => {
    const info: CustomerInfo = {
      entitlements: {
        active: { plus: { identifier: 'plus' } },
      },
    };

    expect(mapEntitlementsToPlan(info)).toBe('plus');
  });

  it('returns "free" when no entitlements are active', () => {
    const info: CustomerInfo = {
      entitlements: { active: {} },
    };

    expect(mapEntitlementsToPlan(info)).toBe('free');
  });

  it('family takes precedence over plus when both are active', () => {
    const info: CustomerInfo = {
      entitlements: {
        active: {
          plus: { identifier: 'plus' },
          family: { identifier: 'family' },
        },
      },
    };

    expect(mapEntitlementsToPlan(info)).toBe('family');
  });

  it('ignores unknown entitlements', () => {
    const info: CustomerInfo = {
      entitlements: {
        active: { premium_legacy: { identifier: 'premium_legacy' } },
      },
    };

    expect(mapEntitlementsToPlan(info)).toBe('free');
  });
});

describe('Subscription — Derived Plan Flags', () => {
  it('free plan: isPlus=false, isFamily=false', () => {
    const flags = derivePlanFlags('free');
    expect(flags.isPlus).toBe(false);
    expect(flags.isFamily).toBe(false);
  });

  it('plus plan: isPlus=true, isFamily=false', () => {
    const flags = derivePlanFlags('plus');
    expect(flags.isPlus).toBe(true);
    expect(flags.isFamily).toBe(false);
  });

  it('family plan: isPlus=true (includes plus access), isFamily=true', () => {
    const flags = derivePlanFlags('family');
    expect(flags.isPlus).toBe(true);
    expect(flags.isFamily).toBe(true);
  });
});
