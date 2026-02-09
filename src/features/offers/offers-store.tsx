"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { EncarteResponse } from "@/lib/schemas";
import { mockOffersByMarket } from "@/features/shared/mock-data";
import { Offer, PromotionDraft } from "@/features/shared/types";

interface OffersStoreValue {
  offersByMarket: Record<string, Offer[]>;
  getOffers: (marketId: string) => Offer[];
  createManualOffer: (marketId: string, draft: PromotionDraft) => void;
  publishImportedOffers: (marketId: string, payload: EncarteResponse) => number;
  toggleOfferStatus: (marketId: string, offerId: string) => void;
}

const STORAGE_KEY = "precomapa_offers_store_v1";

function createInitialStore(): Record<string, Offer[]> {
  return JSON.parse(JSON.stringify(mockOffersByMarket)) as Record<string, Offer[]>;
}

function calculateDiscount(price: number, listPrice: number): number {
  if (listPrice <= 0 || price >= listPrice) {
    return 0;
  }
  return Math.round(((listPrice - price) / listPrice) * 100);
}

function createOfferFromDraft(marketId: string, draft: PromotionDraft): Offer {
  const now = new Date();
  return {
    id: `ofr-${now.getTime()}-${Math.floor(Math.random() * 10000)}`,
    marketId,
    productName: draft.productName,
    brand: draft.brand,
    category: draft.category,
    unit: draft.unit,
    price: draft.price,
    listPrice: draft.listPrice,
    discountPercent: calculateDiscount(draft.price, draft.listPrice),
    validUntil: draft.validUntil,
    verified: true,
    status: "ativa",
    source: "manual",
    createdAt: now.toISOString().slice(0, 10),
    note: draft.note,
  };
}

function createOfferFromImporter(marketId: string, entry: EncarteResponse["products"][number]): Offer {
  const now = new Date();
  const listPrice = Number((entry.price * 1.28).toFixed(2));
  return {
    id: `imp-${now.getTime()}-${Math.floor(Math.random() * 10000)}`,
    marketId,
    productName: entry.name,
    brand: entry.market_origin ?? "Marca não identificada",
    category: "Importadas",
    unit: entry.unit,
    price: entry.price,
    listPrice,
    discountPercent: calculateDiscount(entry.price, listPrice),
    validUntil: entry.validity ?? now.toISOString().slice(0, 10),
    verified: true,
    status: "ativa",
    source: "importador_ia",
    createdAt: now.toISOString().slice(0, 10),
    note: "Oferta importada via OCR + revisão humana",
  };
}

const useOffersStoreBase = create<OffersStoreValue>()(
  persist(
    (set, get) => ({
      offersByMarket: createInitialStore(),
      getOffers: (marketId: string) => get().offersByMarket[marketId] ?? [],
      createManualOffer: (marketId: string, draft: PromotionDraft) => {
        set((state) => {
          const created = createOfferFromDraft(marketId, draft);
          return {
            offersByMarket: {
              ...state.offersByMarket,
              [marketId]: [created, ...(state.offersByMarket[marketId] ?? [])],
            },
          };
        });
      },
      publishImportedOffers: (marketId: string, payload: EncarteResponse) => {
        const created = payload.products.map((entry) => createOfferFromImporter(marketId, entry));

        set((state) => ({
          offersByMarket: {
            ...state.offersByMarket,
            [marketId]: [...created, ...(state.offersByMarket[marketId] ?? [])],
          },
        }));

        return created.length;
      },
      toggleOfferStatus: (marketId: string, offerId: string) => {
        set((state) => {
          const items = state.offersByMarket[marketId] ?? [];
          const updated: Offer[] = items.map((offer): Offer => {
            if (offer.id !== offerId) {
              return offer;
            }
            return {
              ...offer,
              status: offer.status === "ativa" ? "rascunho" : "ativa",
            };
          });

          return {
            offersByMarket: {
              ...state.offersByMarket,
              [marketId]: updated,
            },
          };
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ offersByMarket: state.offersByMarket }),
    },
  ),
);

export function OffersStoreProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useOffersStore(): OffersStoreValue {
  return useOffersStoreBase();
}
