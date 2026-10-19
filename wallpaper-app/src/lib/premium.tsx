import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import {
  LIFETIME_PRICE_FALLBACK,
  LIFETIME_PRODUCT_ID,
  PREMIUM_ENTITLEMENT,
  REVENUECAT_ANDROID_KEY,
  REVENUECAT_IOS_KEY,
} from '../config';

const CACHE_KEY = 'premium.active';

type PremiumState = {
  isPremium: boolean;
  ready: boolean;
  /** False when store billing is not configured (e.g. missing RevenueCat key). */
  storeAvailable: boolean;
  price: string;
  purchase: () => Promise<{ ok: boolean; message?: string }>;
  restore: () => Promise<{ ok: boolean; message?: string }>;
};

const PremiumContext = createContext<PremiumState | null>(null);

const hasEntitlement = (info: CustomerInfo) => info.entitlements.active[PREMIUM_ENTITLEMENT] !== undefined;

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [ready, setReady] = useState(false);
  const [storeAvailable, setStoreAvailable] = useState(false);
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);

  const apply = useCallback((info: CustomerInfo) => {
    const active = hasEntitlement(info);
    setIsPremium(active);
    AsyncStorage.setItem(CACHE_KEY, active ? '1' : '0').catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Show the cached state instantly (works offline), then verify with the store.
      const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
      if (!cancelled && cached === '1') setIsPremium(true);

      const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
      if (!apiKey || Platform.OS === 'web') {
        setReady(true);
        return;
      }
      try {
        Purchases.configure({ apiKey });
        Purchases.addCustomerInfoUpdateListener(apply);
        const [info, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
        if (cancelled) return;
        apply(info);
        const packages = offerings.current?.availablePackages ?? [];
        setPkg(
          packages.find((p) => p.packageType === 'LIFETIME') ??
            packages.find((p) => p.product.identifier.startsWith(LIFETIME_PRODUCT_ID)) ??
            packages[0] ??
            null,
        );
        setStoreAvailable(true);
      } catch (e) {
        console.warn('Billing unavailable', e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(apply);
    };
  }, [apply]);

  const purchase = useCallback(async () => {
    if (!pkg) return { ok: false, message: 'The store is not available right now. Please try again later.' };
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      apply(customerInfo);
      return { ok: hasEntitlement(customerInfo) };
    } catch (e: any) {
      if (e?.userCancelled) return { ok: false };
      return { ok: false, message: e?.message ?? 'Purchase failed.' };
    }
  }, [pkg, apply]);

  const restore = useCallback(async () => {
    if (!storeAvailable) return { ok: false, message: 'The store is not available right now.' };
    try {
      const info = await Purchases.restorePurchases();
      apply(info);
      const ok = hasEntitlement(info);
      return { ok, message: ok ? undefined : 'No previous purchase found for this account.' };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? 'Restore failed.' };
    }
  }, [storeAvailable, apply]);

  const value = useMemo(
    () => ({
      isPremium,
      ready,
      storeAvailable,
      price: pkg?.product.priceString ?? LIFETIME_PRICE_FALLBACK,
      purchase,
      restore,
    }),
    [isPremium, ready, storeAvailable, pkg, purchase, restore],
  );

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used inside PremiumProvider');
  return ctx;
}
