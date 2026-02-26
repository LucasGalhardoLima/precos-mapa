import { useState, useEffect, useCallback } from 'react';
import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@precomapa/shared';

type B2CPlan = 'free' | 'plus' | 'family';

interface SubscriptionState {
  plan: B2CPlan;
  isPlus: boolean;
  isFamily: boolean;
  isLoading: boolean;
  offerings: PurchasesOfferings | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<void>;
}

function mapEntitlementsToPlan(info: CustomerInfo): B2CPlan {
  if (info.entitlements.active['family']) return 'family';
  if (info.entitlements.active['plus']) return 'plus';
  return 'free';
}

export function useSubscription(): SubscriptionState {
  const session = useAuthStore((s) => s.session);
  const [plan, setPlan] = useState<B2CPlan>('free');
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncToSupabase = useCallback(
    async (b2cPlan: B2CPlan) => {
      if (!session?.user) return;
      await supabase
        .from('profiles')
        .update({ b2c_plan: b2cPlan })
        .eq('id', session.user.id);
    },
    [session],
  );

  useEffect(() => {
    async function init() {
      try {
        const info = await Purchases.getCustomerInfo();
        const detectedPlan = mapEntitlementsToPlan(info);
        setPlan(detectedPlan);
        await syncToSupabase(detectedPlan);

        const availableOfferings = await Purchases.getOfferings();
        setOfferings(availableOfferings);
      } catch {
        // RevenueCat not configured (dev/Expo Go)
      } finally {
        setIsLoading(false);
      }
    }

    init();

    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      const updatedPlan = mapEntitlementsToPlan(info);
      setPlan(updatedPlan);
      syncToSupabase(updatedPlan);
    });

    return () => {
      listener?.remove();
    };
  }, [syncToSupabase]);

  const purchasePackage = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        const newPlan = mapEntitlementsToPlan(customerInfo);
        setPlan(newPlan);
        await syncToSupabase(newPlan);
        return true;
      } catch {
        return false;
      }
    },
    [syncToSupabase],
  );

  const restore = useCallback(async () => {
    try {
      const info = await Purchases.restorePurchases();
      const restoredPlan = mapEntitlementsToPlan(info);
      setPlan(restoredPlan);
      await syncToSupabase(restoredPlan);
    } catch {
      // Restore failed
    }
  }, [syncToSupabase]);

  return {
    plan,
    isPlus: plan === 'plus' || plan === 'family',
    isFamily: plan === 'family',
    isLoading,
    offerings,
    purchasePackage,
    restore,
  };
}
